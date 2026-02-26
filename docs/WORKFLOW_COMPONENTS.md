# Workflow Components

This document describes workflow definition components used in case details rendering.

## Repeat Component

Use `repeat` to render the same component structure for each item resolved by `itemsRef`.

### Properties

- `component`: must be `"repeat"`
- `itemsRef`: JSONPath or JSONata expression that resolves to an array
- `items`: component (or array of components) rendered for each item
- `beforeContent` (optional): array of components rendered once before repeated items, only when `itemsRef` resolves to at least one item
- `emptyContent` (optional): array of components rendered when `itemsRef` is empty or missing

### Behaviour

- If `itemsRef` resolves to one or more items:
  - render `beforeContent` (if present)
  - render `items` for each resolved row (with row context available via `@.`)
- If `itemsRef` resolves to no items:
  - render `emptyContent` (if present)
  - otherwise render nothing (`[]`)

### Example: Repeat with `beforeContent`

```json
{
  "component": "repeat",
  "id": "pig-counts",
  "itemsRef": "$.payload.answers.pigs[*]",
  "beforeContent": [
    {
      "component": "heading",
      "text": "Pig counts",
      "level": 3
    }
  ],
  "items": [
    {
      "label": "Total Pigs",
      "text": "@.totalPigs"
    }
  ]
}
```

### Example: Repeat with `emptyContent`

```json
{
  "component": "repeat",
  "id": "pig-counts",
  "itemsRef": "$.payload.answers.pigs[*]",
  "emptyContent": [
    {
      "component": "inset-text",
      "text": "No pig counts available"
    }
  ],
  "items": [
    {
      "label": "Total Pigs",
      "text": "@.totalPigs"
    }
  ]
}
```

### Example: Repeat with templates

```json
{
  "component": "repeat",
  "id": "pig-counts",
  "itemsRef": "$.payload.answers.pigs[*]",
  "beforeContent": [
    {
      "component": "heading",
      "text": "Pig counts",
      "level": 3
    }
  ],
  "emptyContent": [
    {
      "component": "text",
      "text": "No pig counts found."
    }
  ],
  "items": [
    {
      "component": "template",
      "templateRef": "$.templates.pig-count-templates",
      "templateKey": "@.code"
    }
  ]
}
```

## Template Component

Use `template` to render reusable component fragments defined in top-level workflow `templates`.

### Properties

- `component`: must be `"template"`
- `templateRef`: JSONPath to a template group object (for example `$.templates.pig-count-templates`)
- `templateKey`: key for the template entry in that group (can be static or row-relative with `@.`)
- `dataRef` (optional): JSONPath/JSONata resolving row context for template content (commonly used for singular usage)

### Expected template shape

```json
{
  "templates": {
    "pmf-template": {
      "pmf-example": {
        "content": [
          { "component": "heading", "text": "PMF Template", "level": 2 }
        ]
      }
    }
  }
}
```

### Behaviour

- Template content is resolved recursively like normal workflow content.
- If template group, key, or content is missing, rendering is skipped for that component (returns `[]`).
- In repeat context, row-relative `templateKey` (for example `@.code`) is supported.

### Example: Singular template usage

```json
{
  "component": "template",
  "dataRef": "$.payload.answers",
  "templateRef": "$.templates.pmf-template",
  "templateKey": "pmf-example"
}
```

### Example: Template usage inside repeat

```json
{
  "component": "repeat",
  "itemsRef": "$.payload.answers.pigs[*]",
  "items": [
    {
      "component": "template",
      "templateRef": "$.templates.pig-count-templates",
      "templateKey": "@.code"
    }
  ]
}
```
