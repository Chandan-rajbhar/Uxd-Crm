import { db } from './config';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  query, 
  where, 
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';

const SESSION_COLLECTION = 'sessions';

// Get or generate a stable session ID for this browser
const getBrowserSessionId = () => {
  let sessionId = localStorage.getItem('uxd_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('uxd_session_id', sessionId);
  }
  return sessionId;
};

// Enhanced device and browser name from user agent
const getExtendedDeviceInfo = () => {
    const ua = navigator.userAgent;
    let browser = "Unknown Browser";
    let os = "Unknown OS";
    let version = "";

    // Browser Detection
    if (ua.includes("Firefox/")) browser = "Firefox";
    else if (ua.includes("Edg/")) browser = "Edge";
    else if (ua.includes("Chrome/")) browser = "Chrome";
    else if (ua.includes("Safari/")) browser = "Safari";

    // Version Extraction
    const versionMatch = ua.match(/(Firefox|Edg|Chrome|Safari)\/([0-9.]+)/);
    if (versionMatch) version = versionMatch[2].split('.')[0]; 

    // OS Detection
    if (ua.includes("Windows NT 10.0")) os = "Windows 10/11";
    else if (ua.includes("Windows NT 6.3")) os = "Windows 8.1";
    else if (ua.includes("Windows NT 6.2")) os = "Windows 8";
    else if (ua.includes("Windows NT 6.1")) os = "Windows 7";
    else if (ua.includes("Mac OS X")) os = "macOS";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
    else if (ua.includes("Linux")) os = "Linux";

    return {
        browser: `${browser}${version ? ' ' + version : ''}`,
        os: os,
        full: `${browser} on ${os}`
    };
};

export const registerSession = async (uid: string, isAdmin: boolean = false) => {
    const sessionId = getBrowserSessionId();
    const sessionRef = doc(db, SESSION_COLLECTION, `${uid}_${sessionId}`);
    
    // Get extended info
    const device = getExtendedDeviceInfo();
    const resolution = `${window.screen.width}x${window.screen.height}`;
    const network = (navigator as any).connection?.effectiveType || 'Unknown';

    let locationData = { ip: 'Unknown', city: 'Unknown', country: 'Unknown' };
    try {
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
            const data = await response.json();
            locationData = {
                ip: data.ip || 'Unknown',
                city: data.city || 'Unknown',
                country: data.country_name || 'Unknown'
            };
        }
    } catch (e) {
        console.warn("Location tracking blocked or failed", e);
    }

    // Check if user is blocked or limited
    const employeeRef = doc(db, 'employees', uid);
    const employeeSnap = await getDoc(employeeRef);
    let permittedUnits = 10;
    
    if (employeeSnap.exists()) {
        const employeeData = employeeSnap.data();
        permittedUnits = employeeData.permittedDevices ?? 1;
        
        // Block all access if limit is 0
        if (permittedUnits === 0 && !isAdmin) {
            throw new Error('DEVICE_BLOCK');
        }
    }

    const sessionSnap = await getDoc(sessionRef);
    const exists = sessionSnap.exists();

    // If it's a new device (not in session register), check the limit
    if (!exists && !isAdmin) {
        const q = query(collection(db, SESSION_COLLECTION), where('uid', '==', uid));
        const activeSnap = await getDocs(q);
        
        // Filter out stale sessions manually (last 24h)
        const now = Date.now();
        const activeThreshold = 24 * 60 * 60 * 1000;
        const activeCount = activeSnap.docs.filter((d: any) => {
            const data = d.data();
            const lastSeen = data.lastSeen?.toMillis() || now;
            return (now - lastSeen) < activeThreshold;
        }).length;

        if (activeCount >= permittedUnits) {
            throw new Error('DEVICE_LIMIT_REACHED');
        }
    }

    const sessionData: any = {
        uid,
        sessionId,
        deviceName: device.full,
        browser: device.browser,
        os: device.os,
        resolution: resolution,
        network: network,
        ip: locationData.ip,
        location: `${locationData.city}, ${locationData.country}`,
        lastSeen: serverTimestamp(),
        userAgent: navigator.userAgent,
        isCurrent: true,
        isActive: true
    };

    if (!exists) {
        sessionData.registeredAt = serverTimestamp();
    }

    await setDoc(sessionRef, sessionData, { merge: true });
};

export const removeCurrentSession = async (uid: string) => {
  const sessionId = getBrowserSessionId();
  const sessionRef = doc(db, SESSION_COLLECTION, `${uid}_${sessionId}`);
  await setDoc(sessionRef, { 
    isActive: false, 
    isCurrent: false,
    loggedOutAt: serverTimestamp(),
    lastSeen: serverTimestamp()
  }, { merge: true });
};

export const subscribeToActiveSessions = (uid: string, callback: (count: number) => void) => {
  const q = query(
    collection(db, SESSION_COLLECTION),
    where('uid', '==', uid)
  );

  return onSnapshot(q, (snapshot: any) => {
    // Filter out sessions older than 24 hours just in case they didn't logout
    const now = Date.now();
    const activeThreshold = 24 * 60 * 60 * 1000; // 24 hours
    
    const activeCount = snapshot.docs.filter((doc: any) => {
      const data = doc.data();
      const lastSeen = data.lastSeen as any;
      if (!lastSeen) return true; // Just registered
      return (now - lastSeen.toMillis()) < activeThreshold;
    }).length;

    callback(activeCount);
  });
};

export const subscribeToAllSessions = (callback: (sessionCounts: Record<string, number>) => void) => {
  const q = query(collection(db, SESSION_COLLECTION));

  return onSnapshot(q, (snapshot: any) => {
    const now = Date.now();
    const activeThreshold = 24 * 60 * 60 * 1000;
    const counts: Record<string, number> = {};

    snapshot.docs.forEach((docSnap: any) => {
      const data = docSnap.data();
      const uid = data.uid;
      const lastSeen = data.lastSeen as any;
      
      // Filter out stale sessions
      if (lastSeen) {
        if ((now - lastSeen.toMillis()) < activeThreshold) {
          counts[uid] = (counts[uid] || 0) + 1;
        }
      } else {
        // Just registered or missing timestamp
        counts[uid] = (counts[uid] || 0) + 1;
      }
    });

    callback(counts);
  });
};

export const subscribeToDetailedSessions = (callback: (sessions: any[]) => void) => {
  const q = query(collection(db, SESSION_COLLECTION));

  return onSnapshot(q, (snapshot: any) => {
    const sessions = snapshot.docs.map((docSnap: any) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        lastSeen: data.lastSeen?.toMillis() || Date.now()
      };
    });

    callback(sessions);
  });
};
