import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import type { HealthMetrics } from '../types/vidya';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
  'https://www.googleapis.com/auth/fitness.sleep.read',
];

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}

let isSigningIn = false;
// In-memory cache only per workspace-integration security requirement
let cachedAccessToken: string | null = null;

export class GoogleFitConfigurationError extends Error {
  activationUrl: string;
  projectNumber: string;
  reason: 'SERVICE_DISABLED' | 'INSUFFICIENT_SCOPES' | 'API_ERROR';

  constructor(
    message: string,
    options: {
      activationUrl?: string;
      projectNumber?: string;
      reason: 'SERVICE_DISABLED' | 'INSUFFICIENT_SCOPES' | 'API_ERROR';
    }
  ) {
    super(message);
    this.name = 'GoogleFitConfigurationError';
    this.activationUrl =
      options.activationUrl ||
      `https://console.developers.google.com/apis/api/fitness.googleapis.com/overview?project=${
        options.projectNumber || firebaseConfig.messagingSenderId || '172160605854'
      }`;
    this.projectNumber =
      options.projectNumber || firebaseConfig.messagingSenderId || '172160605854';
    this.reason = options.reason;
  }
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve Google OAuth access token from sign-in.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Sign-In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setCustomAccessTokenInMemory = (token: string) => {
  cachedAccessToken = token.trim() || null;
};

export const getCurrentGoogleUser = (): User | null => {
  return auth.currentUser;
};

export const logoutGoogle = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

/**
 * Ensures the "VidyaOS Daily Study Notes" folder exists in the user's Google Drive
 * and returns its folder ID.
 */
async function getOrCreateVidyaOsDriveFolder(accessToken: string): Promise<string> {
  const folderName = 'VidyaOS Daily Study Notes';
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`Google Drive folder lookup failed (${searchRes.status}): ${errText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create Google Drive folder (${createRes.status}): ${errText}`);
  }

  const folderData = await createRes.json();
  return folderData.id;
}

/**
 * Uploads the compiled jsPDF Blob directly to "VidyaOS Daily Study Notes" in Google Drive
 * via multipart upload (`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`).
 */
export async function uploadPdfToGoogleDrive(
  pdfBlob: Blob,
  fileName: string
): Promise<{ fileId: string; folderName: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('Not signed in to Google Drive. Please sign in with Google first.');
  }

  const folderId = await getOrCreateVidyaOsDriveFolder(accessToken);

  const metadata = {
    name: fileName,
    mimeType: 'application/pdf',
    parents: [folderId],
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', pdfBlob, fileName);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Google Drive multipart upload failed (${uploadRes.status}): ${errText}`);
  }

  const data = await uploadRes.json();
  return {
    fileId: data.id,
    folderName: 'VidyaOS Daily Study Notes',
  };
}

/**
 * Fetches real Google Fit metrics for today (synced from boAt Crest/Wearables app into Google Fit)
 * via `https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`.
 */
export async function fetchGoogleFitTodayMetrics(dateStr: string): Promise<HealthMetrics> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('Please connect your Google account to sync Google Fit + boAt Smartwatch metrics.');
  }

  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startTimeMillis = startOfDay.getTime() - 8 * 60 * 60 * 1000;

  const response = await fetch(
    'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aggregateBy: [
          { dataTypeName: 'com.google.step_count.delta' },
          { dataTypeName: 'com.google.heart_rate.bpm' },
          { dataTypeName: 'com.google.calories.expended' },
          { dataTypeName: 'com.google.sleep.segment' },
        ],
        bucketByTime: { durationMillis: now - startTimeMillis },
        startTimeMillis,
        endTimeMillis: now,
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    try {
      const errJson = JSON.parse(errText);
      const errObj = errJson?.error;
      const details = Array.isArray(errObj?.details) ? errObj.details : [];
      const errorInfo = details.find((d: any) => d?.reason === 'SERVICE_DISABLED');
      const isDisabled =
        Boolean(errorInfo) ||
        errObj?.errors?.some((e: any) => e?.reason === 'accessNotConfigured') ||
        String(errObj?.message || '').includes('Fitness API has not been used');

      if (response.status === 403 && isDisabled) {
        const activationUrl =
          errorInfo?.metadata?.activationUrl ||
          `https://console.developers.google.com/apis/api/fitness.googleapis.com/overview?project=${
            errorInfo?.metadata?.containerInfo || firebaseConfig.messagingSenderId || '172160605854'
          }`;
        const projectNumber =
          errorInfo?.metadata?.containerInfo ||
          firebaseConfig.messagingSenderId ||
          '172160605854';

        throw new GoogleFitConfigurationError(
          `The Google Fitness REST API (fitness.googleapis.com) needs to be enabled once in Google Cloud Project ${projectNumber}.`,
          {
            activationUrl,
            projectNumber,
            reason: 'SERVICE_DISABLED',
          }
        );
      }

      if (response.status === 403 || response.status === 401) {
        throw new GoogleFitConfigurationError(
          errObj?.message || 'Google Fit permissions were not granted during sign-in.',
          {
            reason: 'INSUFFICIENT_SCOPES',
          }
        );
      }
    } catch (innerErr) {
      if (innerErr instanceof GoogleFitConfigurationError) {
        throw innerErr;
      }
    }

    throw new Error(
      `Google Fitness API returned status ${response.status}. Please enable the Fitness API in Google Cloud Console or use the boAt Crest Smartwatch Sync options below.`
    );
  }

  const data = await response.json();
  let steps = 0;
  let heartRateBpm = 0;
  let caloriesBurned = 0;
  let sleepMillis = 0;

  const buckets = data.bucket || [];
  for (const bucket of buckets) {
    for (const dataset of bucket.dataset || []) {
      const sourceId = dataset.dataSourceId || '';
      for (const point of dataset.point || []) {
        const val = point.value?.[0];
        if (sourceId.includes('step_count')) {
          steps += val?.intVal || 0;
        } else if (sourceId.includes('heart_rate')) {
          heartRateBpm = Math.round(val?.fpVal || val?.intVal || heartRateBpm);
        } else if (sourceId.includes('calories')) {
          caloriesBurned += Math.round(val?.fpVal || val?.intVal || 0);
        } else if (sourceId.includes('sleep')) {
          const sNanos = Number(point.startTimeNanos || 0);
          const eNanos = Number(point.endTimeNanos || 0);
          if (eNanos > sNanos) {
            sleepMillis += (eNanos - sNanos) / 1e6;
          }
        }
      }
    }
  }

  const sleepHours =
    sleepMillis > 0 ? Math.round((sleepMillis / (1000 * 60 * 60)) * 10) / 10 : 0;

  return {
    date: dateStr,
    steps,
    heartRateBpm,
    caloriesBurned,
    sleepHours,
    syncedFrom: 'Google Fit (boAt Smartwatch Sync)',
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Connects directly to a boAt Smartwatch or Bluetooth LE Heart Rate wearable
 * via the browser's Web Bluetooth API (`navigator.bluetooth`) if supported.
 */
export async function readSmartwatchHeartRateViaWebBluetooth(): Promise<number> {
  const nav = navigator as any;
  if (!nav.bluetooth) {
    throw new Error('Web Bluetooth is not supported in this browser window.');
  }
  const device = await nav.bluetooth.requestDevice({
    filters: [{ services: ['heart_rate'] }],
    optionalServices: ['battery_service'],
  });
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService('heart_rate');
  const characteristic = await service.getCharacteristic('heart_rate_measurement');
  const value: DataView = await characteristic.readValue();
  const flags = value.getUint8(0);
  const is16Bit = (flags & 0x1) !== 0;
  const bpm = is16Bit ? value.getUint16(1, /*littleEndian=*/ true) : value.getUint8(1);
  return bpm;
}
