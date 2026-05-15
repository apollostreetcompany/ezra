export interface ApiBibleClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface ApiBiblePassageData {
  id: string;
  bibleId: string;
  content: string;
  reference: string;
  verseCount: number;
  copyright: string;
}

export interface ApiBibleSearchData {
  query: string;
  limit: number;
  offset: number;
  total: number;
  verseCount: number;
  verses: Array<{
    id: string;
    bibleId: string;
    text: string;
    reference: string;
  }>;
  passages: ApiBiblePassageData[];
}

export interface ApiBibleBibleData {
  id: string;
  abbreviation: string;
  name: string;
  copyright?: string;
}

export interface ApiBibleResponse<T> {
  data: T;
  meta?: {
    fumsToken?: string;
  };
}

export class ApiBibleClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: ApiBibleClientOptions) {
    this.baseUrl = options.baseUrl ?? "https://rest.api.bible/v1";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async listBibles(): Promise<ApiBibleResponse<ApiBibleBibleData[]>> {
    return this.get<ApiBibleBibleData[]>("/bibles", { "include-full-details": "true" });
  }

  async getPassage(input: { bibleId: string; passageId: string; contentType?: "html" | "json" | "text" }): Promise<ApiBibleResponse<ApiBiblePassageData>> {
    return this.get<ApiBiblePassageData>(`/bibles/${encodeURIComponent(input.bibleId)}/passages/${encodeURIComponent(input.passageId)}`, {
      "content-type": input.contentType ?? "html",
      "include-notes": "false",
      "include-titles": "true",
      "fums-version": "3"
    });
  }

  async search(input: { bibleId: string; query: string; limit?: number; offset?: number }): Promise<ApiBibleResponse<ApiBibleSearchData>> {
    return this.get<ApiBibleSearchData>(`/bibles/${encodeURIComponent(input.bibleId)}/search`, {
      query: input.query,
      limit: String(input.limit ?? 10),
      offset: String(input.offset ?? 0),
      "fums-version": "3"
    });
  }

  private async get<T>(path: string, query: Record<string, string>): Promise<ApiBibleResponse<T>> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
    const response = await this.fetchImpl(url, { headers: { "api-key": this.options.apiKey } });
    if (!response.ok) {
      throw new Error(`API.Bible request failed with status ${response.status}`);
    }
    return (await response.json()) as ApiBibleResponse<T>;
  }
}
