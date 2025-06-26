export interface Patient {
  visitNumber: string;
  bpjsNumber: string;
  doctorCode: string;
  clinicName: string;
}

export interface Job extends Patient {
  id: number;
  status: 'pending' | 'processing' | 'done' | 'failed';
  attempt: number;
  response_data?: string;
  created_at: string;
  updated_at: string;
} 