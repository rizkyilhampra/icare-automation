import { getDb } from "../lib/sqlite";
import logger from "../logger";

const HOLIDAY_API_URL =
  "https://raw.githubusercontent.com/guangrei/APIHariLibur_V2/main/holidays.json";

interface HolidayEntry {
  summary: string;
}

interface ApiMetadata {
  author: string;
  link: string;
  updated: string;
}

interface HolidayApiResponse {
  [key: string]: HolidayEntry | ApiMetadata;
  info: ApiMetadata;
}

export class HolidayService {
  private static instance: HolidayService;

  private constructor() {}

  public static getInstance(): HolidayService {
    if (!HolidayService.instance) {
      HolidayService.instance = new HolidayService();
    }
    return HolidayService.instance;
  }

  public cleanExpiredCache(): void {
    const db = getDb();
    const result = db
      .prepare(`DELETE FROM holiday_cache WHERE expires_at < datetime('now')`)
      .run();

    if (result.changes > 0) {
      logger.info(`Cleaned ${result.changes} expired holiday cache entries`, {
        service: "holiday-service",
      });
    }
  }

  private getCachedHolidays(year: number): HolidayApiResponse | null {
    const db = getDb();

    const stmt = db.prepare(`
      SELECT data, cached_at, expires_at 
      FROM holiday_cache 
      WHERE year = ? AND expires_at > datetime('now')
    `);

    const result = stmt.get(year) as
      | { data: string; cached_at: string; expires_at: string }
      | undefined;

    if (result) {
      logger.debug(`Using cached holiday data for year ${year}`, {
        service: "holiday-service",
        cached_at: result.cached_at,
        expires_at: result.expires_at,
      });
      return JSON.parse(result.data);
    }

    return null;
  }

  private cacheHolidays(year: number, data: HolidayApiResponse): void {
    const db = getDb();

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO holiday_cache (year, data, expires_at)
      VALUES (?, ?, ?)
    `);

    stmt.run(year, JSON.stringify(data), expiresAt.toISOString());

    logger.info(`Cached holiday data for year ${year}`, {
      service: "holiday-service",
      expires_at: expiresAt.toISOString(),
      holiday_count: Object.keys(data).filter((key) => key !== "info").length,
    });
  }

  private async fetchHolidaysFromAPI(): Promise<HolidayApiResponse> {
    logger.info("Fetching holidays from Indonesian API", {
      service: "holiday-service",
      url: HOLIDAY_API_URL,
    });

    const response = await fetch(HOLIDAY_API_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as HolidayApiResponse;

    logger.info("Successfully fetched holiday data from API", {
      service: "holiday-service",
      holiday_count: Object.keys(data).filter((key) => key !== "info").length,
      last_updated: data.info.updated,
    });

    return data;
  }

  private async getHolidays(year: number): Promise<HolidayApiResponse> {
    const cached = this.getCachedHolidays(year);
    if (cached) {
      return cached;
    }

    try {
      const data = await this.fetchHolidaysFromAPI();

      const yearlyData: HolidayApiResponse = {
        info: data.info,
      };
      const yearPrefix = year.toString();

      for (const [date, holiday] of Object.entries(data)) {
        if (date.startsWith(yearPrefix) && date !== "info") {
          yearlyData[date] = holiday as HolidayEntry;
        }
      }

      this.cacheHolidays(year, yearlyData);

      return yearlyData;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to fetch holidays from API", {
        service: "holiday-service",
        error: errorMessage,
        year,
      });

      return {
        info: { author: "cache-fallback", link: "", updated: "" },
      };
    }
  }

  public async isHoliday(date: Date): Promise<boolean> {
    const dateString = date.toISOString().split("T")[0];
    const year = date.getFullYear();

    try {
      const holidays = await this.getHolidays(year);
      return dateString in holidays && dateString !== "info";
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Error checking holiday status", {
        service: "holiday-service",
        error: errorMessage,
        date: dateString,
      });
      return false;
    }
  }

  public async getHolidayInfo(date: Date): Promise<string | null> {
    const dateString = date.toISOString().split("T")[0];
    const year = date.getFullYear();

    try {
      const holidays = await this.getHolidays(year);
      const holiday = holidays[dateString] as HolidayEntry | undefined;

      return holiday ? holiday.summary : null;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Error getting holiday info", {
        service: "holiday-service",
        error: errorMessage,
        date: dateString,
      });
      return null;
    }
  }

  public async getUpcomingHolidays(): Promise<
    Array<{ date: string; name: string }>
  > {
    const now = new Date();
    const currentYear = now.getFullYear();

    try {
      const holidays = await this.getHolidays(currentYear);
      const holidayDates = Object.entries(holidays)
        .filter(([key, value]) => {
          if (key === "info") return false;
          const holidayDate = new Date(key);
          const nextMonth = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            now.getDate(),
          );
          return holidayDate >= now && holidayDate <= nextMonth;
        })
        .map(([date, holiday]) => ({
          date,
          name: (holiday as HolidayEntry).summary,
        }));

      return holidayDates;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Error getting upcoming holidays", {
        service: "holiday-service",
        error: errorMessage,
      });
      return [];
    }
  }
}
