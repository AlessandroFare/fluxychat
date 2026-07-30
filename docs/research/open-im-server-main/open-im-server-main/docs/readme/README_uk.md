<p align="center">
    <a href="https://openim.io">
        <img src="../../assets/logo-gif/openim-logo.gif" width="60%" height="30%"/>
    </a>
</p>

<div align="center">

[![Stars](https://img.shields.io/github/stars/openimsdk/open-im-server?style=for-the-badge&logo=github&colorB=ff69b4)](https://github.com/openimsdk/open-im-server/stargazers)
[![Forks](https://img.shields.io/github/forks/openimsdk/open-im-server?style=for-the-badge&logo=github&colorB=blue)](https://github.com/openimsdk/open-im-server/network/members)
[![Codecov](https://img.shields.io/codecov/c/github/openimsdk/open-im-server?style=for-the-badge&logo=codecov&colorB=orange)](https://app.codecov.io/gh/openimsdk/open-im-server)
[![Go Report Card](https://goreportcard.com/badge/github.com/openimsdk/open-im-server?style=for-the-badge)](https://goreportcard.com/report/github.com/openimsdk/open-im-server)
[![Go Reference](https://img.shields.io/badge/Go%20Reference-blue.svg?style=for-the-badge&logo=go&logoColor=white)](https://pkg.go.dev/github.com/openimsdk/open-im-server/v3)
[![License](https://img.shields.io/badge/license-Apache--2.0-green?style=for-the-badge)](https://github.com/openimsdk/open-im-server/blob/main/LICENSE)
[![Slack](https://img.shields.io/badge/Slack-500%2B-blueviolet?style=for-the-badge&logo=slack&logoColor=white)](https://join.slack.com/t/openimsdk/shared_invite/zt-2ijy1ys1f-O0aEDCr7ExRZ7mwsHAVg9A)
[![Best Practices](https://img.shields.io/badge/Best%20Practices-purple?style=for-the-badge)](https://www.bestpractices.dev/projects/8045)
[![Good First Issues](https://img.shields.io/github/issues/openimsdk/open-im-server/good%20first%20issue?style=for-the-badge&logo=github)](https://github.com/openimsdk/open-im-server/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3A%22good+first+issue%22)
[![Language](https://img.shields.io/badge/Language-Go-blue.svg?style=for-the-badge&logo=go&logoColor=white)](https://golang.org/)

<p align="center">
  <a href="../../README.md">English</a> · 
  <a href="../../README_zh_CN.md">中文</a> · 
  <a href="./README_uk.md">Українська</a> · 
  <a href="./README_cs.md">Česky</a> · 
  <a href="./README_hu.md">Magyar</a> · 
  <a href="./README_es.md">Español</a> · 
  <a href="./README_fa.md">فارسی</a> · 
  <a href="./README_fr.md">Français</a> · 
  <a href="./README_de.md">Deutsch</a> · 
  <a href="./README_pl.md">Polski</a> · 
  <a href="./README_id.md">Indonesian</a> · 
  <a href="./README_fi.md">Suomi</a> · 
  <a href="./README_ml.md">മലയാളം</a> · 
  <a href="./README_ja.md">日本語</a> · 
  <a href="./README_nl.md">Nederlands</a> · 
  <a href="./README_it.md">Italiano</a> · 
  <a href="./README_ru.md">Русский</a> · 
  <a href="./README_pt_BR.md">Português (Brasil)</a> · 
  <a href="./README_eo.md">Esperanto</a> · 
  <a href="./README_ko.md">한국어</a> · 
  <a href="./README_ar.md">العربي</a> · 
  <a href="./README_vi.md">Tiếng Việt</a> · 
  <a href="./README_da.md">Dansk</a> · 
  <a href="./README_el.md">Ελληνικά</a> · 
  <a href="./README_tr.md">Türkçe</a>
</p>

</div>

</p>

## Ⓜ️ Про OpenIM

OpenIM -- це сервісна платформа, спеціально розроблена для інтеграції чату, аудіо-відеодзвінків, сповіщень і чат-ботів штучного інтелекту в програми. Він надає ряд потужних API і веб-хуків, що дозволяє розробникам легко включати ці інтерактивні функції у свої програми. OpenIM не є окремою програмою для чату, а скоріше служить платформою для підтримки інших програм у досягненні широких можливостей спілкування. На наступній діаграмі детально показано взаємодію між AppServer, AppClient, OpenIMServer і OpenIMSDK.

![App-OpenIM Relationship](../images/oepnim-design.png)

## 🚀 Про OpenIMSDK

**OpenIMSDK** – це пакет IM SDK, розроблений для **OpenIMServer**, створений спеціально для вбудовування в клієнтські програми. Його основні функції та модулі такі:

- 🌟 Основні характеристики:

  - 📦 Локальне сховище
  - 🔔 Зворотні виклики слухача
  - 🛡️ Обгортка API
  - 🌐 Керування підключенням

- 📚 Основні модулі:

  1. 🚀 Ініціалізація та вхід
  2. 👤 Керування користувачами
  3. 👫 Керування друзями
  4. 🤖 Групові функції
  5. 💬 Ведення розмови

Він створений за допомогою Golang і підтримує кросплатформне розгортання, забезпечуючи послідовний доступ на всіх платформах.

👉 **[Дослідити GO SDK](https://github.com/openimsdk/openim-sdk-core)**

## 🌐 Про OpenIMServer

- **OpenIMServer** має такі характеристики:
  - 🌐 Архітектура мікросервісу: підтримує режим кластера, включаючи шлюз і кілька служб rpc.
  - 🚀 Різноманітні методи розгортання: підтримує розгортання через вихідний код, Kubernetes або Docker.
  - Підтримка величезної бази користувачів: надвеликі групи із сотнями тисяч користувачів, десятками мільйонів користувачів і мільярдами повідомлень.

### Розширена бізнес-функціональність:

- **REST API**: OpenIMServer пропонує REST API для бізнес-систем, спрямованих на надання компаніям додаткових можливостей, таких як створення груп і надсилання push-повідомлень через серверні інтерфейси.
- **Веб-перехоплення**: OpenIMServer надає можливості зворотного виклику, щоб розширити більше бізнес-форм. Зворотний виклик означає, що OpenIMServer надсилає запит на бізнес-сервер до або після певної події, як зворотні виклики до або після надсилання повідомлення.

👉 **[Докладніше](https://docs.openim.io/guides/introduction/product)**

## :building_construction: Загальна архітектура

Пориньте в серце функціональності Open-IM-Server за допомогою нашої діаграми архітектури.

![Overall Architecture](../images/architecture-layers.png)

## :rocket: Швидкий початок

Ми підтримуємо багато платформ. Ось адреси для швидкого використання веб-сайту:

👉 **[Онлайн-демонстрація OpenIM](https://web-enterprise.rentsoft.cn/)**

🤲 Щоб полегшити роботу користувача, ми пропонуємо різні рішення для розгортання. Ви можете вибрати спосіб розгортання зі списку нижче:

- **[Посібник із розгортання вихідного коду](https://docs.openim.io/guides/gettingStarted/imSourceCodeDeployment)**
- **[Посібник із розгортання Docker](https://docs.openim.io/guides/gettingStarted/dockerCompose)**
- **[Посібник із розгортання Kubernetes](https://docs.openim.io/guides/gettingStarted/k8s-deployment)**
- **[Посібник із розгортання розробника Mac](https://docs.openim.io/guides/gettingstarted/mac-deployment-guide)**

## :hammer_and_wrench: Щоб розпочати розробку OpenIM

[![Відкрити в контейнері для розробників](https://img.shields.io/static/v1?label=Dev%20Container&message=Open&color=blue&logo=visualstudiocode)](https://vscode.dev/github/openimsdk/open-im-server)

OpenIM. Наша мета -- побудувати спільноту з відкритим кодом найвищого рівня. У нас є набір стандартів у [репозиторії спільноти](https://github.com/OpenIMSDK/community).

Якщо ви хочете внести свій внесок у це сховище Open-IM-Server, прочитайте нашу [документацію для учасників](https://github.com/openimsdk/open-im-server/blob/main/CONTRIBUTING.md).

Перш ніж почати, переконайтеся, що ваші зміни затребувані. Найкраще для цього створити [нове обговорення](https://github.com/openimsdk/open-im-server/discussions/new/choose) АБО [Нездійснене спілкування](https://join.slack.com/t/openimsdk/shared_invite/zt-2ijy1ys1f-O0aEDCr7ExRZ7mwsHAVg9A)або, якщо ви виявите проблему, спершу [повідомити про неї](https://github.com/openimsdk/open-im-server/issues/new/choose).

- [Довідка щодо API OpenIM](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/api.md)
- [Ведення журналу OpenIM Bash](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/bash-log.md)
- [Дії OpenIM CI/CD](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/cicd-actions.md)
- [Положення про код OpenIM](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/code-conventions.md)
- [Інструкції щодо фіксації OpenIM](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/commit.md)
- [Посібник з розробки OpenIM](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/development.md)
- [Структура каталогу OpenIM](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/directory.md)
- [Налаштування середовища OpenIM](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/environment.md)
- [Довідка про код помилки OpenIM](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/error-code.md)
- [Робочий процес OpenIM Git](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/git-workflow.md)
- [Посібник із вибору OpenIM Git Cherry](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/gitcherry-pick.md)
- [Робочий процес OpenIM GitHub](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/github-workflow.md)
- [Стандарти коду OpenIM Go](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/go-code.md)
- [Інструкції щодо зображення OpenIM](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/images.md)
- [Початкова конфігурація OpenIM](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/init-config.md)
- [Посібник із встановлення OpenIM Docker](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/install-docker.md)
- [Встановлення системи OpenIM OpenIM Linux](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/install-openim-linux-system.md)
- [Посібник із розробки OpenIM Linux](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/linux-development.md)
- [Локальний посібник із дій OpenIM](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/local-actions.md)
- [Положення про протоколювання OpenIM](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/logging.md)
- [Офлайн-розгортання OpenIM](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/offline-deployment.md)
- [Інструменти OpenIM Protoc](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/protoc-tools.md)
- [Посібник з тестування OpenIM](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/test.md)
- [Утиліта OpenIM Go](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/util-go.md)
- [Утиліти OpenIM Makefile](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/util-makefile.md)
- [Утиліти сценарію OpenIM](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/util-scripts.md)
- [Версії OpenIM](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/version.md)
- [Керування серверною частиною та моніторинг розгортання](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/prometheus-grafana.md)
- [Посібник із розгортання розробника Mac для OpenIM](https://github.com/openimsdk/open-im-server/tree/main/docs/contrib/mac-developer-deployment-guide.md)

## :busts_in_silhouette: Спільнота

- 📚 [Спільнота OpenIM](https://github.com/OpenIMSDK/community)
- 💕 [Група інтересів OpenIM](https://github.com/Openim-sigs)
- 🚀 [Приєднайтеся до нашої спільноти Slack](https://join.slack.com/t/openimsdk/shared_invite/zt-2ijy1ys1f-O0aEDCr7ExRZ7mwsHAVg9A)
- :eyes: [Приєднайтеся до нашого wechat](https://openim-1253691595.cos.ap-nanjing.myqcloud.com/WechatIMG20.jpeg)

## :calendar: Збори громади

Ми хочемо, щоб будь-хто долучився до нашої спільноти та додав код, ми пропонуємо подарунки та нагороди, і ми запрошуємо вас приєднатися до нас щочетверга ввечері.

Наша конференція знаходиться в [OpenIM Slack](https://join.slack.com/t/openimsdk/shared_invite/zt-2ijy1ys1f-O0aEDCr7ExRZ7mwsHAVg9A) 🎯, тоді ви можете шукати конвеєр Open-IM-Server, щоб приєднатися.

Ми робимо нотатки про кожну [двотижневу зустріч](https://github.com/orgs/OpenIMSDK/discussions/categories/meeting)в [обговореннях GitHub](https://github.com/openimsdk/open-im-server/discussions/categories/meeting). Наші історичні нотатки зустрічей, а також повтори зустрічей доступні в[Google Docs :bookmark_tabs:](https://docs.google.com/document/d/1nx8MDpuG74NASx081JcCpxPgDITNTpIIos0DS6Vr9GU/edit?usp=sharing).

## :eyes: Хто використовує OpenIM

Перегляньте нашу сторінку [тематичні дослідження користувачів](https://github.com/OpenIMSDK/community/blob/main/ADOPTERS.md), щоб отримати список користувачів проекту. Не соромтеся залишити [📝коментар](https://github.com/openimsdk/open-im-server/issues/379)і поділитися своїм випадком використання.

## :page_facing_up: Ліцензія

OpenIM ліцензовано за ліцензією Apache 2.0. Див. [ЛІЦЕНЗІЯ](https://github.com/openimsdk/open-im-server/tree/main/LICENSE) для повного тексту ліцензії.

Логотип OpenIM, включаючи його варіації та анімовані версії, що відображаються в цьому сховищі[OpenIM](https://github.com/openimsdk/open-im-server)у каталогах [assets/logo](./assets/logo)і [assets/logo-gif](assets/logo-gif) , захищені законами про авторське право.

## 🔮 Дякуємо нашим дописувачам!

<a href="https://github.com/openimsdk/open-im-server/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=openimsdk/open-im-server" />
</a>
