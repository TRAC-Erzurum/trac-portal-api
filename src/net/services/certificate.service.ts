import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';
import { FileStorageService } from '../../shared/storage';
import type { Response } from 'express';
import archiver = require('archiver');
import * as fk from '@pdf-lib/fontkit';
import { PDFDocument, rgb, RGB, type PDFFont } from 'pdf-lib';
import { Net } from '../entities/net.entity';
import { Attendee } from '../entities/attendee.entity';
import type { CertificateTemplateElement } from '../../certificate-template/entities/certificate-template.entity';
import {
  CERTIFICATE_EMBEDDED_FONT_FILE,
  getCertificateFontsDir,
} from '../../certificate-template/certificate-fonts';
import { UserService } from '../../user/services/user.service';
import { MembershipService } from '../../branch/services/membership.service';
import { GlobalRole } from '../../auth/enums/role.enum';
import { extractPlainCallSign } from '../../shared/utils/call-sign.util';

const fontkit = (fk as any).default ?? fk;
const DEFAULT_ELEMENT_BOX_WIDTH = 40;
const DEFAULT_ELEMENT_BOX_HEIGHT = 8;
const DEFAULT_ELEMENT_TEXT_ALIGN: 'left' | 'center' | 'right' = 'left';

@Injectable()
export class CertificateService implements OnModuleInit {
  private certificateFontBytes: Buffer;

  constructor(
    @InjectRepository(Net)
    private readonly netRepository: Repository<Net>,
    @InjectRepository(Attendee)
    private readonly attendeeRepository: Repository<Attendee>,
    private readonly userService: UserService,
    private readonly membershipService: MembershipService,
    private readonly fileStorage: FileStorageService,
  ) {}

  onModuleInit(): void {
    const dir = getCertificateFontsDir();
    this.certificateFontBytes = readFileSync(
      join(dir, CERTIFICATE_EMBEDDED_FONT_FILE),
    );
  }

  /** Returns template imagePath, elements, and placeholders for a single attendee (for UI preview). */
  async getPreviewData(
    netId: string,
    attendeeId: string,
    userId: string,
    userCallSign?: string,
  ): Promise<{
    imagePath: string;
    elements: CertificateTemplateElement[];
    placeholders: Record<string, string>;
  } | null> {
    const can = await this.canDownloadCertificate(
      netId,
      attendeeId,
      userId,
      userCallSign,
    );
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

  /** True if user may download any attendee's certificate (super_admin, net operator, or branch admin/president). */
  async canDownloadAnyCertificate(netId: string, userId: string): Promise<boolean> {
    const net = await this.netRepository.findOne({
      where: { id: netId },
      relations: ['operator', 'operator.user', 'branch'],
    });
    if (!net) return false;
    const effectiveRole = await this.userService.getEffectiveRole(userId);
    if (effectiveRole === GlobalRole.SUPER_ADMIN) return true;
    if (net.operator?.user?.id === userId) return true;
    if (
      await this.membershipService.canActAsBranchLeaderOnBranch(
        userId,
        net.branchId,
      )
    ) {
      return true;
    }
    return false;
  }

  async canDownloadCertificate(
    netId: string,
    attendeeId: string,
    userId: string,
    userCallSign?: string,
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
    if (effectiveRole === GlobalRole.SUPER_ADMIN) return true;
    if (net.operator?.user?.id === userId) return true;
    if (attendee.operator?.user?.id === userId) return true;
    const attendeeCallSign = extractPlainCallSign(attendee.callSign ?? '');
    const actorCallSign = extractPlainCallSign(userCallSign ?? '');
    if (attendeeCallSign && actorCallSign && attendeeCallSign === actorCallSign) {
      return true;
    }
    if (
      await this.membershipService.canActAsBranchLeaderOnBranch(
        userId,
        net.branchId,
      )
    ) {
      return true;
    }
    return false;
  }

  async generatePdf(
    netId: string,
    attendeeId: string,
    userId: string,
    userCallSign?: string,
    res?: Response,
  ): Promise<Buffer | void> {
    const can = await this.canDownloadCertificate(
      netId,
      attendeeId,
      userId,
      userCallSign,
    );
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
      const basename = this.buildCertificatePdfBasename(net, attendee);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        this.buildPdfAttachmentContentDisposition(`${basename}.pdf`),
      );
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
    const operatorCallsign = attendee.callSign;
    const operatorName = attendee.name?.trim();
    const operatorCountry = attendee.country;
    const operatorCity = attendee.city;
    const operatorDistrict = attendee.district;
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

  private formatAttendeeJoinedTimestampForFilename(d: Date): string {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Istanbul',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(d);
    const map: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = p.value;
    }
    const day = map.day ?? '01';
    const month = map.month ?? '01';
    const year = map.year ?? '1970';
    const hour = (map.hour ?? '00').padStart(2, '0');
    const minute = (map.minute ?? '00').padStart(2, '0');
    return `${day}-${month}-${year}-${hour}-${minute}`;
  }

  private formatNetStartedDateOnlyForFilename(d: Date): string {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Istanbul',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const parts = fmt.formatToParts(d);
    const map: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = p.value;
    }
    const day = map.day ?? '01';
    const month = map.month ?? '01';
    const year = map.year ?? '1970';
    return `${day}-${month}-${year}`;
  }

  /** Önce katılımcı createdAt; yoksa çevrim startedAt (sadece tarih). */
  private resolveCertificateFilenameDateStamp(net: Net, attendee: Attendee): string {
    const createdRaw = attendee.createdAt;
    if (createdRaw) {
      const join =
        createdRaw instanceof Date ? createdRaw : new Date(createdRaw);
      if (!Number.isNaN(join.getTime())) {
        return this.formatAttendeeJoinedTimestampForFilename(join);
      }
    }
    const startedRaw = net.startedAt;
    if (startedRaw) {
      const start =
        startedRaw instanceof Date ? startedRaw : new Date(startedRaw);
      if (!Number.isNaN(start.getTime())) {
        return this.formatNetStartedDateOnlyForFilename(start);
      }
    }
    return '01-01-1970-00-00';
  }

  private sanitizeCertificateFilenameSegment(
    raw: string | null | undefined,
    fallback: string,
  ): string {
    let s = String(raw ?? '').trim();
    s = s.replace(/[\u0000-\u001F\\\/:\*\?"<>\|]/g, '');
    s = s.replace(/_/g, '-');
    s = s.replace(/\s+/g, ' ').trim();
    if (!s) return fallback;
    return s;
  }

  /**
   * Çağrıİşareti_ÇevrimAdı_{tarih} (uzantı yok).
   * Tarih: katılımcı createdAt → GG-AA-YYYY-SS-DD; yoksa çevrim startedAt → GG-AA-YYYY.
   */
  private buildCertificatePdfBasename(net: Net, attendee: Attendee): string {
    const op = attendee.operator;
    const callsign =
      op?.callSign ?? attendee.callSign ?? attendee.id.slice(0, 8);
    const netName = net.name ?? 'Cevrim';
    const stamp = this.resolveCertificateFilenameDateStamp(net, attendee);
    const a = this.sanitizeCertificateFilenameSegment(callsign, 'cagri');
    const b = this.sanitizeCertificateFilenameSegment(netName, 'Cevrim');
    const c = this.sanitizeCertificateFilenameSegment(stamp, '01-01-1970-00-00');
    return `${a} - ${b} ${c}`;
  }

  private buildPdfAttachmentContentDisposition(filenameUtf8: string): string {
    const asciiFallback =
      filenameUtf8.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '') ||
      'certificate.pdf';
    return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filenameUtf8)}`;
  }

  /** Optional imageBytes avoids re-reading the same template file when generating many PDFs (e.g. download-all). */
  private async renderPdf(
    template: { imagePath: string; elements: CertificateTemplateElement[] },
    placeholders: Record<string, string>,
    imageBytes?: Buffer,
  ): Promise<Buffer> {
    const bytes =
      imageBytes ?? (await this.fileStorage.getBytes(template.imagePath));
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const font: PDFFont = await pdfDoc.embedFont(this.certificateFontBytes, {
      subset: false,
    });

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
    for (const el of template.elements || []) {
      const text =
        el.type === 'placeholder' && el.placeholderKey
          ? placeholders[el.placeholderKey] ?? el.placeholderKey
          : el.type === 'static' && el.content
            ? el.content
            : '';
      if (!text) continue;
      const color = this.parseColor(el.color || '#000000');
      const boxWidthPercent =
        el.boxWidth ??
        DEFAULT_ELEMENT_BOX_WIDTH;
      const boxHeightPercent =
        el.boxHeight ??
        DEFAULT_ELEMENT_BOX_HEIGHT;
      const textAlign =
        el.textAlign ??
        DEFAULT_ELEMENT_TEXT_ALIGN;

      // x,y box top-left (%); box size de yüzde olarak saklanır.
      const boxX = (el.x / 100) * width;
      const boxY = (el.y / 100) * height;
      const boxWidthPx = (boxWidthPercent / 100) * width;
      const boxHeightPx = (boxHeightPercent / 100) * height;

      const fontSizePx = (el.fontSize || 12) * (height / REFERENCE_HEIGHT);
      const textWidth = font.widthOfTextAtSize(text, fontSizePx);
      const alignedX =
        textAlign === 'center'
          ? boxX + (boxWidthPx - textWidth) / 2
          : textAlign === 'right'
            ? boxX + boxWidthPx - textWidth
            : boxX;
      const xPdf = Math.max(boxX, alignedX);

      // PDF alt-orijin koordinatı için box top-left anchor'ını baseline'a dönüştürüyoruz.
      const yPdf = height - boxY - Math.min(fontSizePx, boxHeightPx);
      page.drawText(text, {
        x: xPdf,
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
    const isBranchLeader =
      await this.membershipService.canActAsBranchLeaderOnBranch(
        userId,
        net.branchId,
      );
    if (
      effectiveRole !== GlobalRole.SUPER_ADMIN &&
      !isNetOperator &&
      !isBranchLeader
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
    const templateImageBytes = await this.fileStorage.getBytes(
      net.certificateTemplate.imagePath,
    );
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
      const entryName = `${this.buildCertificatePdfBasename(net, attendee)}.pdf`;
      archive.append(pdf, { name: entryName });
    }
    await new Promise<void>((resolve, reject) => {
      archive.on('end', resolve);
      archive.on('error', reject);
      archive.finalize();
    });
  }
}
