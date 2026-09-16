export type { TimeRange } from "./ranges";
export { mergeRanges, intersectRanges, subtractRanges } from "./ranges";

export type { Phase } from "./segments";
export { computeOccupiedSegments, computeTotalDuration, isCandidateAvailable } from "./segments";

export type { AvailableSlotsParams } from "./slots";
export {
  computeFreeWindows,
  computeAvailableSlots,
  unionAnyStaffSlots,
  pickLeastBusyStaff,
} from "./slots";
