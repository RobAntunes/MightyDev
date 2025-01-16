// src/lib/architect-client.ts
export class ArchitectClient {
    private baseUrl: string;
  
    constructor(baseUrl: string) {
      this.baseUrl = baseUrl;
    }
  
    async analyze(input: string): Promise<any> {
      const response = await fetch(`${this.baseUrl}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input })
      });
  
      if (!response.ok) {
        throw new Error('Failed to analyze');
      }
  
      return response.json();
    }
  }