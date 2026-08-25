// Composition root: load every parser implementation (side-effect registration)
// before exposing the orchestrator, so callers never wire parsers manually.
import '@/modules/epub-ingest/parser';

export { processContentWork } from './service';
