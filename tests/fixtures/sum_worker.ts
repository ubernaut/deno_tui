import { installWorkerHandler } from "../../mod.ts";

installWorkerHandler<number[], number>((values) => values.reduce((sum, value) => sum + value, 0));
