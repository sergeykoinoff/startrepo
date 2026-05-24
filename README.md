# Node.js TypeScript Project

Пустой проект на Node.js с TypeScript.

## Структура проекта

```
├── src/              # Исходный код TypeScript
│   └── index.ts      # Точка входа
├── dist/             # Скомпилированный JavaScript (генерируется автоматически)
├── package.json      # Конфигурация npm
├── tsconfig.json     # Конфигурация TypeScript
└── README.md         # Этот файл
```

## Установка зависимостей

Перед использованием установите зависимости:

```bash
npm install
```

## Доступные скрипты

- `npm run build` - компиляция TypeScript в JavaScript
- `npm start` - запуск скомпилированного приложения
- `npm run dev` - запуск через ts-node (требует установки ts-node)
- `npm test` - запуск тестов

## Требования

- Node.js >= 14.x
- npm >= 6.x
