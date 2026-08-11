// Thin fetch wrapper for the throwaway dev console. Token storage here is
// deliberately simple (localStorage) — this is a development shell, not a
// pattern to copy for a real client's secure token storage.
import type {
  Appointment,
  AppointmentTrace,
  AssistiveDevice,
  Case,
  Customer,
  LoginResponse,
} from "@pulse/domain";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

let accessToken: string | null = localStorage.getItem("pulse-dev-access-token");

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) localStorage.setItem("pulse-dev-access-token", token);
  else localStorage.removeItem("pulse-dev-access-token");
}

export function isLoggedIn() {
  return accessToken !== null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function listCustomers(organizationId: string): Promise<Customer[]> {
  return request(`/customers?organizationId=${organizationId}`);
}

export function createCustomer(input: {
  organizationId: string;
  name: string;
}): Promise<Customer> {
  return request("/customers", { method: "POST", body: JSON.stringify(input) });
}

export function listAssistiveDevices(customerId: string): Promise<AssistiveDevice[]> {
  return request(`/assistive-devices?customerId=${customerId}`);
}

export function createAssistiveDevice(input: {
  customerId: string;
  label: string;
  deviceType?: string | null;
}): Promise<AssistiveDevice> {
  return request("/assistive-devices", { method: "POST", body: JSON.stringify(input) });
}

export function listCases(assistiveDeviceId: string): Promise<Case[]> {
  return request(`/cases?assistiveDeviceId=${assistiveDeviceId}`);
}

export function createCase(input: {
  assistiveDeviceId: string;
  title: string;
  type?: string | null;
}): Promise<Case> {
  return request("/cases", { method: "POST", body: JSON.stringify(input) });
}

export function listAppointments(caseId: string): Promise<Appointment[]> {
  return request(`/appointments?caseId=${caseId}`);
}

export function createAppointment(input: {
  caseId: string;
  scheduledAt: string;
  notes?: string | null;
}): Promise<Appointment> {
  return request("/appointments", { method: "POST", body: JSON.stringify(input) });
}

export function getTrace(appointmentId: string): Promise<AppointmentTrace> {
  return request(`/appointments/${appointmentId}/trace`);
}
