# ASCII Mermaid Demo

## Flowchart

```mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[OK]
    B -->|No| D[Cancel]
```

## Sequence Diagram

```mermaid
sequenceDiagram
    Alice->>Bob: Hello
    Bob-->>Alice: Hi back
```

## State Diagram

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Active: start
    Active --> Idle: stop
    Active --> [*]
```

## Class Diagram

```mermaid
classDiagram
    Animal <|-- Dog
    Animal: +String name
    Animal: +speak()
    Dog: +fetch()
```

## ER Diagram

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ ITEM : contains
```

## Pie Chart

```mermaid
pie
    title Browser Usage
    "Chrome" : 42
    "Firefox" : 25
    "Safari" : 15
    "Edge" : 10
    "Other" : 8
```

## Timeline

```mermaid
timeline
    title Project Roadmap
    section Phase 1
        2023 : Planning : Research
        2024 : Development
    section Phase 2
        2025 : Launch : Support
```

## Gantt Chart

```mermaid
gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Planning
        Requirements :done, req1, 2024-01-01, 14d
        Design       :active, des1, after req1, 21d
    section Development
        Backend      :crit, dev1, 2024-02-05, 30d
        Frontend     :dev2, 2024-02-05, 28d
    section Deployment
        Release      :milestone, rel1, 2024-03-06, 0d
```
