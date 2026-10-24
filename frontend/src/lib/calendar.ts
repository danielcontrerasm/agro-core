import { readDemo, saveDemo } from './demo';

export type CalendarRule = {
  id: number; farmId: number; region: string; cropId: number; varietyId?: number;
  crop: string; variety?: string; seasonName: string; windowFromMonth?: number; windowFromDay?: number;
  windowToMonth?: number; windowToDay?: number; perennial: boolean; preparationLeadDays: number;
  notes?: string; active: boolean;
};
export type CalendarSuggestion = {
  calendarId: number; farmId: number; region: string; cropId: number; varietyId?: number;
  crop: string; variety?: string; seasonName: string; windowFrom?: string; windowTo?: string;
  perennial: boolean; preparationLeadDays: number; notes?: string;
};
export type CalendarRequest = {
  farmId: number; region: string; cropId: number; varietyId?: number | null; seasonName: string;
  windowFromMonth?: number; windowFromDay?: number; windowToMonth?: number; windowToDay?: number;
  perennial: boolean; preparationLeadDays: number; notes?: string;
};

export const calendarKey = 'planting-calendars';

export const demoCalendars = (): CalendarRule[] => [{
  id: 1, farmId: 1, region: 'Zona Bananera, Magdalena', cropId: 1, varietyId: 1, crop: 'Banano', variety: 'Cavendish',
  seasonName: 'Producción continua', perennial: true, preparationLeadDays: 30,
  notes: 'El banano establecido permite renovación y resiembra durante todo el año.', active: true,
}];

export function readCalendarsDemo(): CalendarRule[] { return readDemo(calendarKey, demoCalendars()); }
export function readCalendarsForFarm(farmId: number): CalendarRule[] { return readCalendarsDemo().filter(rule => rule.farmId === farmId); }
export function saveCalendarsDemo(value: CalendarRule[]) { return saveDemo(calendarKey, value); }

export function demoSuggestions(rules: CalendarRule[], cropId: number, varietyId?: number): CalendarSuggestion[] {
  const year = new Date().getFullYear();
  return rules.filter(rule => rule.active && rule.cropId === cropId && (rule.varietyId === varietyId || rule.varietyId == null))
    .sort((left, right) => Number(right.varietyId === varietyId) - Number(left.varietyId === varietyId))
    .map(rule => {
      if (rule.perennial) return { calendarId: rule.id, farmId: rule.farmId, region: rule.region, cropId: rule.cropId, varietyId: rule.varietyId, crop: rule.crop, variety: rule.variety, seasonName: rule.seasonName, perennial: true, preparationLeadDays: rule.preparationLeadDays, notes: rule.notes };
      const from = recurringDate(year, rule.windowFromMonth!, rule.windowFromDay!);
      const crossesYear = rule.windowToMonth! < rule.windowFromMonth! || (rule.windowToMonth === rule.windowFromMonth && rule.windowToDay! < rule.windowFromDay!);
      const to = recurringDate(crossesYear ? year + 1 : year, rule.windowToMonth!, rule.windowToDay!);
      return { calendarId: rule.id, farmId: rule.farmId, region: rule.region, cropId: rule.cropId, varietyId: rule.varietyId, crop: rule.crop, variety: rule.variety, seasonName: rule.seasonName, windowFrom: from, windowTo: to, perennial: false, preparationLeadDays: rule.preparationLeadDays, notes: rule.notes };
    });
}

function recurringDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, 1);
  date.setDate(Math.min(day, new Date(year, month, 0).getDate()));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
