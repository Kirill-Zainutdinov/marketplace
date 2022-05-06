Основной контракт - контракт marketplace.sol

Этот контракт позволяет создавать токены стандартов ERC721 и ERC1155. Особенностью реализации является то, что любой пользователь может через контракт маркетплейса создать эти токены с своими метаданными.
Далее эти токены можно выставлять на продажу в маркетплейсе за определённые токены стандарта ERC20.

Также особенностью реализации контракта является то, что в нём практически нету view функций, но во всех важных функциях есть евенты.
Предполагается, что внение приложения (сайты, мобильные приложения) будут вытаскивать информацию именно из евентов контракта, а не посредством вызвоа view функций.

Скрипты:
Скрипт deployAll.ts не только деплоит четыре контракта (3 токена и маркетплейс), но также выполняет подготовительную часть для тестирования работы маркетплейса в тестовой сети, а именно:
- выдаёт разрешение минтить токены от имени контракта маркетплейса на контрактах токенов
- минтит несколько токенов
- выставляет несколько токенов на продажу и на аукцион

Таски:
Реализованы таски для эмиссии 721 и 1155 токенов

Тесты:
Реализованы тесты с 100% покрытием для всех 4 контрактов

Контракты задеплоины в тестовой сети rinkeby по адресам:

Token erc20 deployed to: 0x52f051165079FFDa3095D2F8f3bf375B7375DD1C

Token erc721 deployed to: 0xE539C3696dd666332BBe13cfB4EB1A79c6c9ae5A

Token erc1155 deployed to: 0x537A1Dd855e358EBE1dE51E8C9c2e7b528e21A61

Marketplace deployed to: 0x3b19E348DB389561BD32c9Bf39B28C7eD42A62b1