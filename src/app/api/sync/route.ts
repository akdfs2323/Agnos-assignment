import { NextRequest, NextResponse } from 'next/server';

export interface PatientData {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dob?: string;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  preferredLanguage?: string;
  nationality?: string;
  emergencyName?: string;
  emergencyRelationship?: string;
  religion?: string;
}

export interface PatientSession {
  id: string;
  data: PatientData;
  status: 'filling' | 'inactive' | 'submitted';
  lastActive: number;
}

// Extend global namespace to store sessions cache
declare global {
  var socketIoSessions: Map<string, PatientSession> | undefined;
}

export async function GET() {
  const sessionsMap = global.socketIoSessions;
  const sessions = sessionsMap 
    ? Array.from(sessionsMap.values())
    : [];
  
  return NextResponse.json({ success: true, sessions });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, data, status } = body as {
      sessionId: string;
      data: PatientData;
      status: PatientSession['status'];
    };
    
    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'sessionId required' }, { status: 400 });
    }

    if (!global.socketIoSessions) {
      global.socketIoSessions = new Map<string, PatientSession>();
    }

    const currentSession = global.socketIoSessions.get(sessionId) || { 
      id: sessionId, 
      data: {}, 
      status: 'filling' as const, 
      lastActive: Date.now() 
    };
    
    const updatedSession: PatientSession = {
      id: sessionId,
      data: data || currentSession.data || {},
      status: status || currentSession.status || 'filling',
      lastActive: Date.now()
    };

    global.socketIoSessions.set(sessionId, updatedSession);

    return NextResponse.json({ success: true, session: updatedSession });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
