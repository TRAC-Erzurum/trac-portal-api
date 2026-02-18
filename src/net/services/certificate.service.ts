import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Readable } from 'stream';
import type { Response } from 'express';
import archiver from 'archiver';
import { PDFDocument, rgb, RGB, StandardFonts } from 'pdf-lib';
import { Net } from '../entities/net.entity';
import { Attendee } from '../entities/attendee.entity';
import type { CertificateTemplateElement } from '../../certificate-template/entities/certificate-template.entity';
import { UserService } from '../../user/services/user.service';
import { MembershipService } from '../../branch/services/membership.service';
import { BranchRole } from '../../branch/enums/branch-role.enum';
import { Role } from '../../auth/enums/role.enum';

@Injectable()
export class CertificateService {
  constructor(
    @InjectRepository(Net)
    private readonly netRepository: Repository<Net>,
    @InjectRepository(Attendee)
    private readonly attendeeRepository: Repository<Attendee>,
    private readonly userService: UserService,
    private readonly membershipService: MembershipService,
  ) {}

  /** Returns template imagePath, elements, and placeholders for a single attendee (for UI preview). */
  async getPreviewData(
    netId: string,
    attendeeId: string,
    userId: string,
  ): Promise<{
    imagePath: string;
    elements: CertificateTemplateElement[];
    placeholders: Record<string, string>;
  } | null> {
    const can = await this.canDownloadCertificate(netId, attendeeId, userId);
    if (!can) return null;
    const net = await this.netRepository.findOne({
      where: { id: netId },
      relations: [
        'certificateTemplate',
        'branch',
        'branch.callSigns',
        'operator',
      ],
    });
    if (!net?.certificateTemplate) return null;
    const attendees = await this.attendeeRepository.find({
      where: { net: { id: netId } },
      relations: ['operator'],
      order: { createdAt: 'ASC' },
    });
    const attendeeIndex = attendees.findIndex((a) => a.id === attendeeId);
    const attendee = attendeeIndex >= 0 ? attendees[attendeeIndex] : null;
    if (!attendee) return null;
    const placeholders = this.buildPlaceholders(
      net,
      attendee,
      attendeeIndex + 1,
      attendees.length,
    );
    return {
      imagePath: net.certificateTemplate.imagePath,
      elements: net.certificateTemplate.elements ?? [],
      placeholders,
    };
  }

  /** True if user may download any attendee's certificate (super_admin, net operator, or branch admin). */
  async canDownloadAnyCertificate(netId: string, userId: string): Promise<boolean> {
    const net = await this.netRepository.findOne({
      where: { id: netId },
      relations: ['operator', 'operator.user', 'branch'],
    });
    if (!net) return false;
    const effectiveRole = await this.userService.getEffectiveRole(userId);
    if (effectiveRole === Role.SUPER_ADMIN) return true;
    if (net.operator?.user?.id === userId) return true;
    const membership = await this.membershipService.findMembership(
      userId,
      net.branchId,
    );
    if (membership?.status === 'approved' && membership.role === BranchRole.ADMIN)
      return true;
    return false;
  }

  async canDownloadCertificate(
    netId: string,
    attendeeId: string,
    userId: string,
  ): Promise<boolean> {
    const net = await this.netRepository.findOne({
      where: { id: netId },
      relations: ['operator', 'operator.user', 'branch'],
    });
    if (!net) return false;
    if (!net.endedAt) return false; // only completed nets
    const attendee = await this.attendeeRepository.findOne({
      where: { id: attendeeId, net: { id: netId } },
      relations: ['operator', 'operator.user'],
    });
    if (!attendee) return false;
    const effectiveRole = await this.userService.getEffectiveRole(userId);
    if (effectiveRole === Role.SUPER_ADMIN) return true;
    if (net.operator?.user?.id === userId) return true;
    if (attendee.operator?.user?.id === userId) return true;
    const membership = await this.membershipService.findMembership(
      userId,
      net.branchId,
    );
    if (membership?.status === 'approved' && membership.role === BranchRole.ADMIN)
      return true;
    return false;
  }

  async generatePdf(
    netId: string,
    attendeeId: string,
    userId: string,
    res?: Response,
  ): Promise<Buffer | void> {
    const can = await this.canDownloadCertificate(netId, attendeeId, userId);
    if (!can) {
      throw new ForbiddenException('error.forbiddenDescription');
    }
    const net = await this.netRepository.findOne({
      where: { id: netId },
      relations: [
        'certificateTemplate',
        'branch',
        'branch.callSigns',
        'operator',
      ],
    });
    if (!net) throw new NotFoundException('error.notFound');
    if (!net.endedAt) throw new ForbiddenException('error.netNotCompleted');
    if (!net.certificateTemplate)
      throw new NotFoundException('error.certificateTemplateNotFound');
    const attendees = await this.attendeeRepository.find({
      where: { net: { id: netId } },
      relations: ['operator'],
      order: { createdAt: 'ASC' },
    });
    const attendeeIndex = attendees.findIndex((a) => a.id === attendeeId);
    const attendee = attendeeIndex >= 0 ? attendees[attendeeIndex] : null;
    if (!attendee) throw new NotFoundException('error.notFound');
    const order = attendeeIndex + 1;
    const placeholders = this.buildPlaceholders(
      net,
      attendee,
      order,
      attendees.length,
    );
    const pdfBuffer = await this.renderPdf(net.certificateTemplate, placeholders);
    if (res) {
      return new Promise<void>((resolve, reject) => {
        const stream = Readable.from(pdfBuffer);
        stream.pipe(res);
        stream.on('end', resolve);
        stream.on('error', reject);
      });
    }
    return pdfBuffer;
  }

  private buildPlaceholders(
    net: Net,
    attendee: Attendee,
    order: number,
    _totalAttendees: number,
  ): Record<string, string> {
    const netDate = net.endedAt || net.scheduledAt;
    const dateStr = netDate
      ? this.formatDateForSerial(netDate)
      : '';
    const ddmmyy = netDate ? this.formatDdMmyy(netDate) : '';
    const orderStr = String(order).padStart(4, '0');
    const branchCallSign =
      net.branchCallSign?.callSign ??
      net.branch?.callSigns?.find((c) => c.isDefault)?.callSign ??
      '';
    const serial = branchCallSign
      ? `${branchCallSign}-${ddmmyy}-${orderStr}`
      : `${ddmmyy}-${orderStr}`;
    const op = attendee.operator;
    const operatorCallsign = op?.callSign ?? attendee.callSign ?? '';
    const operatorName = op?.fullName ?? attendee.name ?? '';
    const operatorCountry = op?.country ?? attendee.country ?? '';
    const operatorCity = op?.city ?? attendee.city ?? '';
    const operatorDistrict = op?.district ?? attendee.district ?? '';
    const netOperatorCallsign = net.operator?.callSign ?? '';
    const netOperatorName = net.operator?.fullName ?? '';
    const branchName = net.branch?.name ?? '';
    const netName = net.name ?? '';
    const netDateFormatted = netDate
      ? this.formatDateDisplay(netDate)
      : '';

    return {
      operator_callsign: operatorCallsign,
      operator_name: operatorName,
      operator_country: operatorCountry,
      operator_city: operatorCity,
      operator_district: operatorDistrict,
      net_operator_callsign: netOperatorCallsign,
      net_operator_name: netOperatorName,
      branch_name: branchName,
      branch_callsign: branchCallSign,
      net_name: netName,
      net_date: netDateFormatted,
      certificate_serial: serial,
      participant_number: orderStr,
      issue_date: netDateFormatted,
    };
  }

  private formatDateForSerial(d: Date): string {
    const date = new Date(d);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${String(day).padStart(2, '0')}${String(month).padStart(2, '0')}${year}`;
  }

  private formatDdMmyy(d: Date): string {
    const date = new Date(d);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear() % 100;
    return `${String(day).padStart(2, '0')}${String(month).padStart(2, '0')}${String(year).padStart(2, '0')}`;
  }

  private formatDateDisplay(d: Date): string {
    const date = new Date(d);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${String(day).padStart(2, '0')} ${String(month).padStart(2, '0')} ${year}`;
  }

  private parseColor(hexOrName: string): RGB {
    const hex = hexOrName.replace(/^#/, '');
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      return rgb(r, g, b);
    }
    return rgb(0, 0, 0);
  }

  /** Optional imageBytes avoids re-reading the same template file when generating many PDFs (e.g. download-all). */
  private async renderPdf(
    template: { imagePath: string; elements: CertificateTemplateElement[] },
    placeholders: Record<string, string>,
    imageBytes?: Buffer,
  ): Promise<Buffer> {
    const bytes =
      imageBytes ??
      (await readFile(
        join(process.cwd(), template.imagePath.replace(/^\//, '')),
      ));
    const pdfDoc = await PDFDocument.create();
    const isPng =
      template.imagePath.toLowerCase().endsWith('.png') ||
      template.imagePath.toLowerCase().includes('.png');
    const image = isPng
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);
    const width = image.width;
    const height = image.height;
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });

    const REFERENCE_HEIGHT = 300;
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    for (const el of template.elements || []) {
      const text =
        el.type === 'placeholder' && el.placeholderKey
          ? placeholders[el.placeholderKey] ?? el.placeholderKey
          : el.type === 'static' && el.content
            ? el.content
            : '';
      if (!text) continue;
      const color = this.parseColor(el.color || '#000000');
      // x,y 0–100 (%) olarak saklanıyor; piksele çeviriyoruz
      const xPx = (el.x / 100) * width;
      const yPx = (el.y / 100) * height;
      const fontSizePx = (el.fontSize || 12) * (height / REFERENCE_HEIGHT);
      const yPdf = height - yPx - fontSizePx;
      page.drawText(text, {
        x: xPx,
        y: yPdf,
        size: fontSizePx,
        font,
        color,
      });
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  async generateAllPdfs(
    netId: string,
    userId: string,
    res: Response,
  ): Promise<void> {
    const net = await this.netRepository.findOne({
      where: { id: netId },
      relations: [
        'operator',
        'operator.user',
        'branch',
        'branch.callSigns',
        'certificateTemplate',
      ],
    });
    if (!net) throw new NotFoundException('error.notFound');
    if (!net.endedAt) throw new ForbiddenException('error.netNotCompleted');
    if (!net.certificateTemplate)
      throw new NotFoundException('error.certificateTemplateNotFound');
    const effectiveRole = await this.userService.getEffectiveRole(userId);
    const isNetOperator = net.operator?.user?.id === userId;
    const membership = await this.membershipService.findMembership(
      userId,
      net.branchId,
    );
    const isBranchAdmin =
      membership?.status === 'approved' &&
      membership.role === BranchRole.ADMIN;
    if (
      effectiveRole !== Role.SUPER_ADMIN &&
      !isNetOperator &&
      !isBranchAdmin
    ) {
      throw new ForbiddenException('error.forbiddenDescription');
    }
    const netNameSanitized = (net.name || 'net').replace(/[^a-zA-Z0-9-_]/g, '-');
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${netNameSanitized}-certificates.zip"`,
    });
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    const attendees = await this.attendeeRepository.find({
      where: { net: { id: netId } },
      relations: ['operator'],
      order: { createdAt: 'ASC' },
    });
    const imagePath = join(
      process.cwd(),
      net.certificateTemplate.imagePath.replace(/^\//, ''),
    );
    const templateImageBytes = await readFile(imagePath);
    for (let i = 0; i < attendees.length; i++) {
      const attendee = attendees[i];
      const placeholders = this.buildPlaceholders(
        net,
        attendee,
        i + 1,
        attendees.length,
      );
      const pdf = await this.renderPdf(
        net.certificateTemplate,
        placeholders,
        templateImageBytes,
      );
      const callsign = (attendee.callSign || `attendee-${i + 1}`).replace(
        /[^a-zA-Z0-9-_]/g,
        '_',
      );
      archive.append(pdf, { name: `${callsign}.pdf` });
    }
    await new Promise<void>((resolve, reject) => {
      archive.on('end', resolve);
      archive.on('error', reject);
      archive.finalize();
    });
  }
}
