export type RuntimeStatsSnapshotOptions = {
  includeMemory?: boolean;
  includeHandleCount?: boolean;
};

type MemorySample = {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
};

export type RuntimeStatsSnapshot = {
  roomsCreated: number;
  roomsDisposed: number;
  joins: number;
  leaves: number;
  activeRooms: number;
  activeClients: number;
  capturedAt: string;
  memory?: MemorySample;
  handles?: {
    activeHandleCount: number;
  };
};

type RuntimeStatsState = {
  roomsCreated: number;
  roomsDisposed: number;
  joins: number;
  leaves: number;
  activeRooms: number;
  activeClients: number;
};

const state: RuntimeStatsState = {
  roomsCreated: 0,
  roomsDisposed: 0,
  joins: 0,
  leaves: 0,
  activeRooms: 0,
  activeClients: 0,
};

function clampNonNegative(value: number): number {
  const next = Math.trunc(value);
  return next < 0 || !Number.isFinite(next) ? 0 : next;
}

export const setActiveRooms = (value: number): number => {
  state.activeRooms = clampNonNegative(value);
  return state.activeRooms;
};

export const setActiveClients = (value: number): number => {
  state.activeClients = clampNonNegative(value);
  return state.activeClients;
};

export const incrementActiveRooms = (delta = 1): number => {
  state.activeRooms = clampNonNegative(state.activeRooms + delta);
  return state.activeRooms;
};

export const decrementActiveRooms = (delta = 1): number => {
  state.activeRooms = clampNonNegative(state.activeRooms - delta);
  return state.activeRooms;
};

export const incrementActiveClients = (delta = 1): number => {
  state.activeClients = clampNonNegative(state.activeClients + delta);
  return state.activeClients;
};

export const decrementActiveClients = (delta = 1): number => {
  state.activeClients = clampNonNegative(state.activeClients - delta);
  return state.activeClients;
};

export const recordRoomCreated = (): void => {
  state.roomsCreated += 1;
  incrementActiveRooms(1);
};

export const recordRoomDisposed = (): void => {
  state.roomsDisposed += 1;
  decrementActiveRooms(1);
};

export const recordJoin = (): void => {
  state.joins += 1;
  incrementActiveClients(1);
};

export const recordLeave = (): void => {
  state.leaves += 1;
  decrementActiveClients(1);
};

export const getHandleCount = (): number | null => {
  const processApi = globalThis.process;
  const processWithHandles = processApi as typeof processApi & {
    _getActiveHandles?: () => unknown[];
  };

  if (
    typeof processApi === "undefined" ||
    typeof processWithHandles._getActiveHandles !== "function"
  ) {
    return null;
  }

  try {
    const handles = processWithHandles._getActiveHandles();
    return clampNonNegative(handles.length);
  } catch (_err) {
    return null;
  }
};

export const sampleMemoryUsage = (): MemorySample | undefined => {
  const processApi = globalThis.process;

  if (typeof processApi === "undefined" || typeof processApi.memoryUsage !== "function") {
    return undefined;
  }

  const usage = processApi.memoryUsage();

  return {
    rss: usage.rss,
    heapTotal: usage.heapTotal,
    heapUsed: usage.heapUsed,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers,
  };
};

export const snapshot = (options: RuntimeStatsSnapshotOptions = {}): RuntimeStatsSnapshot => {
  const { includeMemory = false, includeHandleCount = false } = options;

  const snapshotData: RuntimeStatsSnapshot = {
    roomsCreated: state.roomsCreated,
    roomsDisposed: state.roomsDisposed,
    joins: state.joins,
    leaves: state.leaves,
    activeRooms: state.activeRooms,
    activeClients: state.activeClients,
    capturedAt: new Date().toISOString(),
  };

  if (includeMemory) {
    const memory = sampleMemoryUsage();
    if (memory) snapshotData.memory = memory;
  }

  if (includeHandleCount) {
    const activeHandleCount = getHandleCount();
    if (activeHandleCount !== null) {
      snapshotData.handles = { activeHandleCount };
    }
  }

  return snapshotData;
};

const runtimeStats = {
  setActiveRooms,
  setActiveClients,
  incrementActiveRooms,
  decrementActiveRooms,
  incrementActiveClients,
  decrementActiveClients,
  recordRoomCreated,
  recordRoomDisposed,
  recordJoin,
  recordLeave,
  getHandleCount,
  sampleMemoryUsage,
  snapshot,
};

export default runtimeStats;
