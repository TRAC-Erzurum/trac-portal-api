import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedInfrastructureTutorials1770319558346 implements MigrationInterface {
  name = 'SeedInfrastructureTutorials1770319558346';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tutorials = [
      {
        type: 'vhf_uhf_repeater',
        locale: 'tr',
        title: 'VHF/UHF Röleye Nasıl Bağlanılır?',
        content: `## VHF/UHF Röle Kullanımı

### Gerekli Ekipman
- VHF veya UHF bandında çalışabilen bir telsiz
- Uygun anten (genellikle dikey polarizasyon)

### Bağlantı Adımları

1. **Frekansları Ayarlayın**
   - RX (alma) frekansını rölenin TX frekansına ayarlayın
   - TX (verme) frekansını rölenin RX frekansına ayarlayın
   - Veya offset değerini girin (genellikle +/- 600 kHz)

2. **Ton Ayarları**
   - CTCSS tonu varsa, TX için ilgili tonu seçin
   - DCS kodu varsa, ilgili kodu seçin

3. **Test Yapın**
   - PTT tuşuna basarak röleyi açmaya çalışın
   - Rölenin kuyruk sinyalini (tail) dinleyin

### Önemli Notlar
- Röleye bağlanmadan önce dinleyin, devam eden bir QSO olabilir
- Çağrı işaretinizi her zaman kullanın
- Uzun konuşmalar yapmayın, röleyi meşgul etmeyin`,
      },
      {
        type: 'vhf_uhf_repeater',
        locale: 'en',
        title: 'How to Connect to a VHF/UHF Repeater?',
        content: `## VHF/UHF Repeater Usage

### Required Equipment
- A radio capable of VHF or UHF band operation
- Appropriate antenna (usually vertical polarization)

### Connection Steps

1. **Set Frequencies**
   - Set RX (receive) frequency to the repeater's TX frequency
   - Set TX (transmit) frequency to the repeater's RX frequency
   - Or enter the offset value (usually +/- 600 kHz)

2. **Tone Settings**
   - If CTCSS tone is required, select the appropriate tone for TX
   - If DCS code is required, select the appropriate code

3. **Test**
   - Press PTT to try to key up the repeater
   - Listen for the repeater's tail signal

### Important Notes
- Listen before transmitting, there may be an ongoing QSO
- Always use your callsign
- Keep transmissions brief, don't tie up the repeater`,
      },
      {
        type: 'dmr',
        locale: 'tr',
        title: 'DMR Röleye Nasıl Bağlanılır?',
        content: `## DMR (Digital Mobile Radio) Kullanımı

### Gerekli Ekipman
- DMR uyumlu telsiz (Motorola, Hytera, TYT, Anytone vb.)
- Kayıtlı bir DMR ID

### Ön Hazırlık

1. **DMR ID Alın**
   - [radioid.net](https://radioid.net) adresinden kayıt olun
   - Çağrı işaretiniz için bir DMR ID alın
   - Telsisinize bu ID'yi tanımlayın

2. **Codeplug Hazırlayın**
   - Röle frekanslarını girin
   - Talkgroup'ları tanımlayın
   - Color Code ve Time Slot ayarlarını yapın

### Bağlantı Adımları

1. **Kanal Ayarları**
   - RX/TX frekanslarını girin
   - Color Code'u ayarlayın (genellikle 1)
   - Time Slot'u seçin (TS1 veya TS2)

2. **Talkgroup Seçimi**
   - Yerel TG: Sadece o röle
   - Bölgesel TG: Bölgedeki röleler
   - Ulusal/Uluslararası TG: Geniş alan

3. **İletişim**
   - PTT'ye basarak konuşun
   - Bırakınca röle bağlantıyı sürdürür

### Önemli Notlar
- Her zaman doğru TG'de olduğunuzdan emin olun
- Kerchunk yapmayın (boş PTT)
- Çağrı işaretinizi söyleyin`,
      },
      {
        type: 'dmr',
        locale: 'en',
        title: 'How to Connect to a DMR Repeater?',
        content: `## DMR (Digital Mobile Radio) Usage

### Required Equipment
- DMR compatible radio (Motorola, Hytera, TYT, Anytone, etc.)
- A registered DMR ID

### Preparation

1. **Get a DMR ID**
   - Register at [radioid.net](https://radioid.net)
   - Obtain a DMR ID for your callsign
   - Program this ID into your radio

2. **Prepare Codeplug**
   - Enter repeater frequencies
   - Define talkgroups
   - Configure Color Code and Time Slot settings

### Connection Steps

1. **Channel Settings**
   - Enter RX/TX frequencies
   - Set the Color Code (usually 1)
   - Select Time Slot (TS1 or TS2)

2. **Talkgroup Selection**
   - Local TG: Only that repeater
   - Regional TG: Repeaters in the region
   - National/International TG: Wide area

3. **Communication**
   - Press PTT to talk
   - Release and the repeater maintains the connection

### Important Notes
- Always ensure you're on the correct TG
- Don't kerchunk (empty PTT)
- State your callsign`,
      },
      {
        type: 'echolink',
        locale: 'tr',
        title: "EchoLink'e Nasıl Bağlanılır?",
        content: `## EchoLink Kullanımı

### EchoLink Nedir?
EchoLink, internet üzerinden amatör telsiz bağlantısı sağlayan bir sistemdir. Bilgisayar, akıllı telefon veya telsiz ile kullanılabilir.

### Gerekli Ekipman (Seçenekler)

**Seçenek 1: Bilgisayar/Telefon**
- EchoLink yazılımı (Windows, iOS, Android)
- İnternet bağlantısı
- Geçerli amatör lisansı

**Seçenek 2: Telsiz ile**
- EchoLink bağlantılı bir röle
- DTMF tuş takımı

### Kayıt ve Doğrulama

1. [echolink.org](https://www.echolink.org) adresinden yazılımı indirin
2. Çağrı işaretinizle kayıt olun
3. Lisans doğrulaması yapın (birkaç gün sürebilir)

### Kullanım

**Yazılım ile:**
1. Node listesinden istediğiniz node'u bulun
2. Bağlan butonuna tıklayın
3. Bağlantı kurulunca konuşun

**Telsiz ile:**
1. EchoLink rölesine bağlanın
2. DTMF ile node numarasını girin
3. Bağlantı kurulunca konuşun

### Önemli Notlar
- Bağlantıyı bitirince # tuşuna basın
- Uzun monologlardan kaçının
- Çağrı işaretinizi düzenli söyleyin`,
      },
      {
        type: 'echolink',
        locale: 'en',
        title: 'How to Connect to EchoLink?',
        content: `## EchoLink Usage

### What is EchoLink?
EchoLink is a system that enables amateur radio connections over the internet. It can be used with a computer, smartphone, or radio.

### Required Equipment (Options)

**Option 1: Computer/Phone**
- EchoLink software (Windows, iOS, Android)
- Internet connection
- Valid amateur license

**Option 2: Via Radio**
- A repeater connected to EchoLink
- DTMF keypad

### Registration and Validation

1. Download the software from [echolink.org](https://www.echolink.org)
2. Register with your callsign
3. Complete license validation (may take a few days)

### Usage

**With Software:**
1. Find the desired node from the node list
2. Click the Connect button
3. Talk once connected

**With Radio:**
1. Connect to an EchoLink repeater
2. Enter the node number using DTMF
3. Talk once connected

### Important Notes
- Press # when finished to disconnect
- Avoid long monologues
- State your callsign regularly`,
      },
      {
        type: 'aprs',
        locale: 'tr',
        title: 'APRS Ağına Nasıl Bağlanılır?',
        content: `## APRS (Automatic Packet Reporting System) Kullanımı

### APRS Nedir?
APRS, konum, hava durumu, mesaj ve telemetri verilerini paket radyo üzerinden ileten bir sistemdir.

### Gerekli Ekipman

**Seçenek 1: Dedicated APRS Cihazı**
- Kenwood TH-D74, TH-D72
- Yaesu FT3D, FT5D
- veya benzer APRS özellikli telsiz

**Seçenek 2: TNC + Telsiz**
- Bir TNC (Terminal Node Controller)
- 2m bandında çalışan telsiz
- Bilgisayar ve APRS yazılımı

**Seçenek 3: Sadece İzleme**
- [aprs.fi](https://aprs.fi) web sitesi
- APRSDroid (Android) uygulaması

### Kurulum

1. **Frekans Ayarı**
   - Türkiye için: 144.800 MHz
   - Avrupa geneli: 144.800 MHz
   - Kuzey Amerika: 144.390 MHz

2. **SSID Seçimi**
   - -1 ile -4: Taşınabilir istasyonlar
   - -5: Akıllı telefon
   - -9: Araç
   - -10: İnternet gateway

3. **Yol Ayarları (Path)**
   - WIDE1-1,WIDE2-1 (standart)
   - Şehir içinde: WIDE1-1

### Önemli Notlar
- Beacon aralığını çok kısa tutmayın (2-5 dakika yeterli)
- Digipeater yükünü artırmayın
- Konum bilgilerinizin doğruluğunu kontrol edin`,
      },
      {
        type: 'aprs',
        locale: 'en',
        title: 'How to Connect to APRS Network?',
        content: `## APRS (Automatic Packet Reporting System) Usage

### What is APRS?
APRS is a system that transmits position, weather, messages, and telemetry data over packet radio.

### Required Equipment

**Option 1: Dedicated APRS Device**
- Kenwood TH-D74, TH-D72
- Yaesu FT3D, FT5D
- or similar APRS-capable radio

**Option 2: TNC + Radio**
- A TNC (Terminal Node Controller)
- A radio operating on 2m band
- Computer and APRS software

**Option 3: Monitoring Only**
- [aprs.fi](https://aprs.fi) website
- APRSDroid (Android) app

### Setup

1. **Frequency Setting**
   - Europe: 144.800 MHz
   - North America: 144.390 MHz
   - Check local frequency for your region

2. **SSID Selection**
   - -1 to -4: Portable stations
   - -5: Smartphone
   - -9: Vehicle
   - -10: Internet gateway

3. **Path Settings**
   - WIDE1-1,WIDE2-1 (standard)
   - In urban areas: WIDE1-1

### Important Notes
- Don't set beacon interval too short (2-5 minutes is sufficient)
- Don't overload digipeaters
- Verify your position accuracy`,
      },
      {
        type: 'hf',
        locale: 'tr',
        title: 'HF Bandında İletişim Kurma',
        content: `## HF (Kısa Dalga) İletişimi

### HF Nedir?
HF (High Frequency) bandı, 3-30 MHz arası frekansları kapsar. İyonosferden yansıma ile uzak mesafe iletişimi sağlar.

### Gerekli Ekipman
- HF telsiz (100W önerilir)
- HF anteni (dipol, vertikal, beam vb.)
- Anten tuner (gerekirse)
- SWR metre

### Amatör HF Bantları

| Bant | Frekans | Özellik |
|------|---------|---------|
| 80m | 3.5-3.8 MHz | Gece, bölgesel |
| 40m | 7.0-7.2 MHz | Gece/gündüz, orta mesafe |
| 20m | 14.0-14.35 MHz | Gündüz, DX |
| 15m | 21.0-21.45 MHz | Gündüz, DX |
| 10m | 28.0-29.7 MHz | Güneş aktivitesi yüksekken |

### Modlar

**SSB (Single Side Band)**
- LSB: 80m, 40m bantlarında
- USB: 20m ve üstü bantlarda

**CW (Mors)**
- Her bantta kullanılabilir
- Dar bant, uzak mesafe için ideal

**Dijital Modlar**
- FT8: Zayıf sinyal modu, çok popüler
- JS8Call: Mesajlaşma
- RTTY: Klasik dijital mod

### Önemli Notlar
- Propagasyon tahminlerini takip edin
- Band planına uyun
- QRM'den kaçının, dinleyin önce`,
      },
      {
        type: 'hf',
        locale: 'en',
        title: 'HF Band Communication',
        content: `## HF (Shortwave) Communication

### What is HF?
HF (High Frequency) band covers frequencies from 3-30 MHz. It enables long-distance communication through ionospheric reflection.

### Required Equipment
- HF radio (100W recommended)
- HF antenna (dipole, vertical, beam, etc.)
- Antenna tuner (if needed)
- SWR meter

### Amateur HF Bands

| Band | Frequency | Characteristics |
|------|-----------|-----------------|
| 80m | 3.5-3.8 MHz | Night, regional |
| 40m | 7.0-7.3 MHz | Day/night, medium distance |
| 20m | 14.0-14.35 MHz | Daytime, DX |
| 15m | 21.0-21.45 MHz | Daytime, DX |
| 10m | 28.0-29.7 MHz | When solar activity is high |

### Modes

**SSB (Single Side Band)**
- LSB: On 80m, 40m bands
- USB: On 20m and above bands

**CW (Morse)**
- Can be used on all bands
- Narrow band, ideal for long distance

**Digital Modes**
- FT8: Weak signal mode, very popular
- JS8Call: Messaging
- RTTY: Classic digital mode

### Important Notes
- Follow propagation predictions
- Follow the band plan
- Avoid QRM, listen first`,
      },
    ];

    for (const tutorial of tutorials) {
      const escapedContent = tutorial.content.replace(/'/g, "''");
      const escapedTitle = tutorial.title.replace(/'/g, "''");

      await queryRunner.query(`
        INSERT INTO "infrastructure_tutorials" ("type", "locale", "title", "content")
        VALUES ('${tutorial.type}', '${tutorial.locale}', '${escapedTitle}', '${escapedContent}')
        ON CONFLICT ("type", "locale") DO UPDATE SET
          "title" = EXCLUDED."title",
          "content" = EXCLUDED."content",
          "updatedAt" = now();
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "infrastructure_tutorials"`);
  }
}
