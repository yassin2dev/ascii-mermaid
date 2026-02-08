# Supported Diagram Types

ascii-mermaid supports five Mermaid diagram types. Flowcharts and state diagrams share the grid-based rendering pipeline, while sequence, class, and ER diagrams each have specialized renderers.

## Flowcharts

**Headers:** `graph TD`, `graph LR`, `flowchart TD`, `flowchart LR`, etc.

**Directions:** `TD`/`TB` (top-down), `LR` (left-right), `BT` (bottom-top), `RL` (right-left)

### Node Shapes

| Syntax | Shape | Rendered As |
|---|---|---|
| `A[text]` | Rectangle | `┌────┐ │text│ └────┘` |
| `A(text)` | Rounded | `╭────╮ │text│ ╰────╯` |
| `A{text}` | Diamond | `◇ text ◇` |
| `A([text])` | Stadium | `(text)` pill shape |
| `A((text))` | Circle | `circular border` |
| `A[[text]]` | Subroutine | `double-bordered rectangle` |
| `A(((text)))` | Double circle | `concentric circles` |
| `A{{text}}` | Hexagon | `six-sided shape` |
| `A[(text)]` | Cylinder | `database drum` |
| `A>text]` | Asymmetric | `flag/banner shape` |
| `A[/text\]` | Trapezoid | `wider bottom` |
| `A[\text/]` | Trapezoid-alt | `wider top` |

### Edge Styles

| Syntax | Style |
|---|---|
| `A --> B` | Solid line with arrow |
| `A --- B` | Solid line, no arrow |
| `A -.-> B` | Dotted line with arrow |
| `A -.- B` | Dotted line, no arrow |
| `A ==> B` | Thick line with arrow |
| `A === B` | Thick line, no arrow |
| `A <--> B` | Bidirectional arrow |
| `A -->\|label\| B` | Edge with label |

### Features

- **Chaining:** `A --> B --> C` creates edges A-to-B and B-to-C
- **Parallel:** `A & B --> C & D` creates edges from each source to each target
- **Subgraphs:** `subgraph name ... end` with nesting support
- **Direction overrides:** `direction LR` inside a subgraph
- **Styling:** `classDef`, `style`, and `:::className` shorthand

### Example

```mermaid
flowchart TD
    A[Start] --> B{Is valid?}
    B -->|Yes| C[Process]
    B -->|No| D[Error]
    C --> E[End]
    D --> E
```

## State Diagrams

**Header:** `stateDiagram-v2`

### Syntax

| Syntax | Meaning |
|---|---|
| `[*] --> State1` | Start transition |
| `State1 --> [*]` | End transition |
| `State1 --> State2` | Transition |
| `State1 --> State2 : label` | Labeled transition |
| `state "Description" as s1` | State with alias |
| `s1 : Description` | State description |

### Composite States

```mermaid
stateDiagram-v2
    state "Active" as active {
        Idle --> Processing : event
        Processing --> Idle : done
    }
```

Composite states render as nested subgraphs containing their child states.

### Pseudostates

- `[*]` at the start of a transition creates a **start pseudostate** (filled circle `●`)
- `[*]` at the end creates an **end pseudostate** (bullseye `⊙`)
- Each `[*]` reference generates a unique node ID to allow multiple start/end points

## Sequence Diagrams

**Header:** `sequenceDiagram`

### Participants

```
participant A as Alice
actor B as Bob
```

`participant` renders as a box, `actor` renders as a stick figure label. Actors referenced in messages but not explicitly declared are auto-created.

### Messages

| Syntax | Arrow Style |
|---|---|
| `A->>B: text` | Solid line, filled arrowhead |
| `A-->>B: text` | Dashed line, filled arrowhead |
| `A-)B: text` | Solid line, open arrowhead |
| `A--)B: text` | Dashed line, open arrowhead |

### Activation

| Syntax | Effect |
|---|---|
| `A->>+B: text` | Activate B |
| `B-->>-A: text` | Deactivate B |

Activation is shown as a thickened section of the lifeline.

### Blocks

```mermaid
sequenceDiagram
    Alice->>Bob: Request
    alt Success
        Bob-->>Alice: 200 OK
    else Failure
        Bob-->>Alice: 500 Error
    end
```

Supported blocks: `loop`, `alt`/`else`, `opt`, `par`/`and`, `critical`, `break`, `rect`

### Notes

```
Note left of A: text
Note right of B: text
Note over A,B: text
```

## Class Diagrams

**Header:** `classDiagram`

### Class Definitions

```
class Animal {
    +String name
    +int age
    #List~Food~ diet
    +eat(food) bool
    -sleep()
    #digest(food)* bool
}
```

Visibility markers: `+` public, `-` private, `#` protected, `~` package

### Annotations

```
class Shape {
    <<interface>>
    +draw()
}
```

Supported: `<<interface>>`, `<<abstract>>`, `<<service>>`, `<<enumeration>>`

### Relationships

```mermaid
classDiagram
    Animal <|-- Dog : inherits
    Car *-- Engine : composition
    University o-- Department : aggregation
    Person --> Address : association
```

| Syntax | Relationship | Marker |
|---|---|---|
| `A <\|-- B` | Inheritance | Hollow triangle `△` |
| `A *-- B` | Composition | Filled diamond `◆` |
| `A o-- B` | Aggregation | Hollow diamond `◇` |
| `A --> B` | Association | Arrow `→` |
| `A ..> B` | Dependency | Dashed arrow |
| `A ..\|> B` | Realization | Dashed + hollow triangle |

### Cardinality

```
Customer "1" --> "*" Order
```

### Namespaces

```
namespace com.example {
    class Foo
    class Bar
}
```

## ER Diagrams

**Header:** `erDiagram`

### Entities

```
CUSTOMER {
    string name PK
    string email UK
    int age
}
```

Attribute constraints: `PK` (primary key), `FK` (foreign key), `UK` (unique key)

### Relationships

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
```

### Cardinality Notation

| Syntax | Meaning | Crow's Foot |
|---|---|---|
| `\|\|` | Exactly one | `║` |
| `o\|` | Zero or one | `o║` |
| `}\|` | One or more | `╟` |
| `o{` | Zero or more | `o╟` |

### Line Styles

| Syntax | Meaning |
|---|---|
| `--` | Identifying (solid line) |
| `..` | Non-identifying (dashed line) |

### Example

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER {
        string name PK
        string email
    }
    ORDER {
        int id PK
        date created
    }
```
