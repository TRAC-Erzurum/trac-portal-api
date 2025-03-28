[![API Build](https://github.com/TRAC-Erzurum/trac-portal-api/actions/workflows/docker-ghrc.yaml/badge.svg)](https://github.com/TRAC-Erzurum/trac-portal-api/actions/workflows/docker-ghrc.yaml)
---

### Geliştirme Ortamının Hazırlanması

1. Projeyi forklayın
2. Yeni bir feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Gerekli bağımlılıkları yükleyin:
   ```bash
   # Backend için
   cd backend && yarn install
   
   # Frontend için
   cd frontend && yarn install
   ```
4. Geliştirme ortamını Docker ile başlatın:
   ```bash
   docker-compose up --build -d
   ```

### Branch Politikası

- `master` ve `dev` branchleri korumalı branchlerdir
- Tüm geliştirmeler `dev` branchinden türetilen feature branchlerinde yapılmalıdır
- Pull requestler `dev` branchine açılmalıdır

### Pull Request Kuralları

1. **Branch İsimlendirmesi**
   - Feature için: `feature/özellik-adı`
   - Bug fix için: `fix/hata-açıklaması`
   - Hotfix için: `hotfix/acil-düzeltme`

2. **Commit Mesajları**
   - İngilizce yazılmalıdır
   - Açıklayıcı ve kısa olmalıdır
   - Örnek format: `feat: add new attendee list`

3. **PR İçeriği**
   - Her PR tek bir amaca hizmet etmelidir
   - PR açıklaması şablona uygun doldurulmalıdır
   - Yapılan değişikliklerin test edildiğinden emin olunmalıdır
   - Conflict olmamalıdır

4. **Code Review**
   - PR'ın merge edilebilmesi için en az bir onay gereklidir
   - Review yorumları yapıcı ve açıklayıcı olmalıdır
   - Tüm CI/CD kontrolleri başarılı olmalıdır

5. **Dokümantasyon**
   - Yeni özellikler için dokümantasyon güncellenmelidir





## CI/CD

### GitHub Actions ve Container Registry

Proje, `GitHub Actions` ile, belirli ön koşullar sağlandığında build edilir ve `GitHub Container Registry`ye (ghcr.io) yüklenir. İki farklı build alınmaktadır:

- Development (dev) modu: `dev` branche yapılan her pushta tetiklenir. `dev-build.{{build_id}}` etiketi ile versiyonlanır. Ayrıca son güncel dev buildi `dev` etiketine sahiptir.
- Release modu: Yeni bir tag oluşturulduğunda tetiklenerek tag adı ile versiyonlanır. Ayrıca son güncel release buildi `latest` etiketine sahiptir.

### Production Ortamına Kurulum

1. Sunucunuzda Docker ve Docker Compose'un kurulu olduğundan emin olun
2. Production ortamı için gerekli environment değişkenlerini ayarlayın
3. Container'ları çekin ve başlatın:

```bash
# Production ortamı için docker-compose dosyasını kullanarak
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Değişkenleri

Production ortamı için gerekli environment değişkenleri:

```env
# Backend
DATABASE_URL=postgresql://user:password@db:5432/dbname
JWT_SECRET=your-secret-key
API_PORT=3000

# Frontend
API_BASE_URL=https://api.example.com
```




<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ yarn install
```

## Compile and run the project

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Run tests

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ yarn install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
