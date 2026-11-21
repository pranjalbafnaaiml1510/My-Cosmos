import type { DataMode } from "../types";
import type { DataSource } from "./dataSource";
import { httpAdapter } from "./httpAdapter";
import { mockAdapter } from "./mockAdapter";

export const DATA_MODE: DataMode = import.meta.env.VITE_DATA_MODE === "production" ? "production" : "mock";

/** Swap data sources via VITE_DATA_MODE — UI components never import an adapter directly. */
export const api: DataSource = DATA_MODE === "production" ? httpAdapter : mockAdapter;
