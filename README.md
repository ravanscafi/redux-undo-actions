# redux-undo-actions

A different undo/redo approach for Redux, tracking actions instead of state.

## Documentation

### Simple use case

```mermaid
flowchart LR
    Init@{ shape: sm-circ }
    End@{ shape: framed-circle }
    subgraph Tracked Actions
        subgraph 1 ["Undoable Action"]
            A(canvas/start)
        end
        subgraph 2 ["Undoable Action"]
            B(canvas/draw)
        end
        subgraph 3 ["Undoable Action"]
            C(canvas/zoom-in)
        end
        subgraph 4 ["Undoable Action"]
            D(canvas/draw)
        end
        subgraph 5 ["Undoable Action"]
            E(canvas/zoom-in)
        end
    end

    Init --> A
    A --> B
    B --> C
    C --> D
    D --> E
    E --> End
```

### Make only some actions undoable

```mermaid
flowchart LR
    Init@{ shape: sm-circ }
    End@{ shape: framed-circle }
    subgraph Tracked Actions
        A(canvas/start)

        subgraph 2 ["Undoable Action"]
            B(canvas/draw)
        end

        C(canvas/zoom-in)

        subgraph 4 ["Undoable Action"]
            D(canvas/draw)
        end


        E(canvas/zoom-in)
    end

    Init --> A
    A --> B
    B --> C
    C --> D
    D --> E
    E --> End
```

After first undo

```mermaid
flowchart LR
    Init@{ shape: sm-circ }
    End@{ shape: framed-circle }
    subgraph Tracked Actions
        A(canvas/start)

        subgraph 2 ["Undoable Action"]
            B(canvas/draw)
        end

        C(canvas/zoom-in)

        E(canvas/zoom-in)
    end

    Init --> A
    A --> B
    B --> C
    C --> E
    E --> End
```

After second undo

```mermaid
flowchart LR
    Init@{ shape: sm-circ }
    End@{ shape: framed-circle }
    subgraph Tracked Actions
        A(canvas/start)

        C(canvas/zoom-in)

        E(canvas/zoom-in)
    end

    Init --> A
    A --> C
    C --> E
    E --> End
```

### Custom track after action

```mermaid
flowchart LR
    Init@{ shape: sm-circ }
    End@{ shape: framed-circle }
    FA(canvas/start)
    FB(canvas/draw)
    FC(canvas/zoom-in)
    FD(canvas/draw)
    FE(canvas/zoom-in)
    A(canvas/start)

    subgraph Tracked Actions
        subgraph 2 ["Undoable Action"]
            B(canvas/draw)
        end

        C(canvas/zoom-in)

        subgraph 4 ["Undoable Action"]
            D(canvas/draw)
        end


        E(canvas/zoom-in)
    end


    Init --> FA
    FA --> FB
    FB --> FC
    FC --> FD
    FD --> FE

    FE --> A
    A --> B
    B --> C
    C --> D
    D --> E
    E --> End

    classDef startAction fill:#f9f
    class A,FA startAction
```

## Development

- Install dependencies:

```bash
npm install
```

- Run the unit tests:

```bash
npm run test
```

- Build the library:

```bash
npm run build
```
