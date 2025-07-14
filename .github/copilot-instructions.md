<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

Questo è un progetto per convertire file JSON (generati da modelli Simulink .mdl) in diagrammi di flusso interattivi.

## Contesto del Progetto
- Parser per JSON di blocchi Simulink
- Renderer basato su D3.js per visualizzazione interattiva
- Supporto per diversi tipi di blocchi Simulink
- Layout automatico con algoritmi di forza
- Esportazione in SVG/PNG

## Linee Guida di Sviluppo
- Usa TypeScript per type safety
- Mantieni la compatibilità con diversi formati JSON di Simulink
- Priorità all'usabilità e performance del rendering
- Supporta tutti i tipi di blocchi Simulink comuni
- Implementa pattern di design modulari e estensibili

## Struttura dei File
- `src/types.ts` - Definizioni TypeScript per blocchi Simulink
- `src/parser.ts` - Parser per diversi formati JSON
- `src/renderer.ts` - Renderer D3.js per visualizzazione
- `src/main.ts` - Applicazione principale e UI
