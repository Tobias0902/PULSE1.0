import { FormEvent, useEffect, useState } from "react";
import type { Appointment, AssistiveDevice, Case, Customer } from "@pulse/domain";
import * as api from "./api";

interface Session {
  organizationId: string;
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);

  if (!session) {
    return <LoginScreen onLoggedIn={setSession} />;
  }
  return <Console organizationId={session.organizationId} onLogout={() => setSession(null)} />;
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: (session: Session) => void }) {
  const [email, setEmail] = useState("admin@pulse.dev");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const response = await api.login(email, password);
      api.setAccessToken(response.accessToken);
      onLoggedIn({ organizationId: response.organizationId });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="page">
      <DevBanner />
      <form className="panel" onSubmit={handleSubmit}>
        <h2>Sign in</h2>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit">Sign in</button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}

function Console({ organizationId, onLogout }: { organizationId: string; onLogout: () => void }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [device, setDevice] = useState<AssistiveDevice | null>(null);
  const [caseRecord, setCaseRecord] = useState<Case | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);

  return (
    <div className="page">
      <DevBanner />
      <header className="topbar">
        <Breadcrumb
          customer={customer}
          device={device}
          caseRecord={caseRecord}
          appointment={appointment}
          onSelectCustomer={() => {
            setCustomer(null);
            setDevice(null);
            setCaseRecord(null);
            setAppointment(null);
          }}
          onSelectDevice={() => {
            setDevice(null);
            setCaseRecord(null);
            setAppointment(null);
          }}
          onSelectCase={() => {
            setCaseRecord(null);
            setAppointment(null);
          }}
        />
        <button onClick={onLogout}>Sign out</button>
      </header>

      {!customer && (
        <CustomerStep organizationId={organizationId} onSelect={setCustomer} />
      )}
      {customer && !device && (
        <AssistiveDeviceStep customer={customer} onSelect={setDevice} />
      )}
      {device && !caseRecord && <CaseStep device={device} onSelect={setCaseRecord} />}
      {caseRecord && !appointment && (
        <AppointmentStep caseRecord={caseRecord} onSelect={setAppointment} />
      )}
      {appointment && <TraceView appointmentId={appointment.id} />}
    </div>
  );
}

function DevBanner() {
  return (
    <div className="dev-banner">
      PULSE dev console — throwaway development/admin shell, not the final Cockpit UI.
    </div>
  );
}

function Breadcrumb({
  customer,
  device,
  caseRecord,
  appointment,
  onSelectCustomer,
  onSelectDevice,
  onSelectCase,
}: {
  customer: Customer | null;
  device: AssistiveDevice | null;
  caseRecord: Case | null;
  appointment: Appointment | null;
  onSelectCustomer: () => void;
  onSelectDevice: () => void;
  onSelectCase: () => void;
}) {
  return (
    <nav className="breadcrumb">
      <button onClick={onSelectCustomer}>Customer{customer ? `: ${customer.name}` : ""}</button>
      {customer && (
        <>
          {" → "}
          <button onClick={onSelectDevice}>
            AssistiveDevice{device ? `: ${device.label}` : ""}
          </button>
        </>
      )}
      {device && (
        <>
          {" → "}
          <button onClick={onSelectCase}>Case{caseRecord ? `: ${caseRecord.title}` : ""}</button>
        </>
      )}
      {caseRecord && appointment && (
        <>
          {" → "}
          <span>Appointment: {new Date(appointment.scheduledAt).toLocaleString()}</span>
        </>
      )}
    </nav>
  );
}

function CustomerStep({
  organizationId,
  onSelect,
}: {
  organizationId: string;
  onSelect: (customer: Customer) => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    api.listCustomers(organizationId).then(setCustomers);
  }, [organizationId]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const created = await api.createCustomer({ organizationId, name });
    setName("");
    setCustomers((prev) => [...prev, created]);
  }

  return (
    <section className="panel">
      <h2>Customers</h2>
      <ul>
        {customers.map((c) => (
          <li key={c.id}>
            <button onClick={() => onSelect(c)}>{c.name}</button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleCreate}>
        <input
          placeholder="Customer name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit">Create customer</button>
      </form>
    </section>
  );
}

function AssistiveDeviceStep({
  customer,
  onSelect,
}: {
  customer: Customer;
  onSelect: (device: AssistiveDevice) => void;
}) {
  const [devices, setDevices] = useState<AssistiveDevice[]>([]);
  const [label, setLabel] = useState("");
  const [deviceType, setDeviceType] = useState("");

  useEffect(() => {
    api.listAssistiveDevices(customer.id).then(setDevices);
  }, [customer.id]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const created = await api.createAssistiveDevice({
      customerId: customer.id,
      label,
      deviceType: deviceType || null,
    });
    setLabel("");
    setDeviceType("");
    setDevices((prev) => [...prev, created]);
  }

  return (
    <section className="panel">
      <h2>AssistiveDevices for {customer.name}</h2>
      <ul>
        {devices.map((d) => (
          <li key={d.id}>
            <button onClick={() => onSelect(d)}>
              {d.label} {d.deviceType ? `(${d.deviceType})` : ""}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleCreate}>
        <input
          placeholder="Device label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
        <input
          placeholder="Device type (free text, optional)"
          value={deviceType}
          onChange={(e) => setDeviceType(e.target.value)}
        />
        <button type="submit">Create device</button>
      </form>
    </section>
  );
}

function CaseStep({
  device,
  onSelect,
}: {
  device: AssistiveDevice;
  onSelect: (caseRecord: Case) => void;
}) {
  const [cases, setCases] = useState<Case[]>([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");

  useEffect(() => {
    api.listCases(device.id).then(setCases);
  }, [device.id]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const created = await api.createCase({
      assistiveDeviceId: device.id,
      title,
      type: type || null,
    });
    setTitle("");
    setType("");
    setCases((prev) => [...prev, created]);
  }

  return (
    <section className="panel">
      <h2>Cases for {device.label}</h2>
      <ul>
        {cases.map((c) => (
          <li key={c.id}>
            <button onClick={() => onSelect(c)}>
              {c.title} [{c.status}] {c.type ? `- ${c.type}` : ""}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleCreate}>
        <input
          placeholder="Case title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <input
          placeholder="Case type (free text, optional — not a fixed list)"
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
        <button type="submit">Create case</button>
      </form>
    </section>
  );
}

function AppointmentStep({
  caseRecord,
  onSelect,
}: {
  caseRecord: Case;
  onSelect: (appointment: Appointment) => void;
}) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [scheduledAt, setScheduledAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    api.listAppointments(caseRecord.id).then(setAppointments);
  }, [caseRecord.id]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const created = await api.createAppointment({
      caseId: caseRecord.id,
      scheduledAt: new Date(scheduledAt).toISOString(),
      notes: notes || null,
    });
    setNotes("");
    setAppointments((prev) => [...prev, created]);
  }

  return (
    <section className="panel">
      <h2>Appointments for {caseRecord.title}</h2>
      <ul>
        {appointments.map((a) => (
          <li key={a.id}>
            <button onClick={() => onSelect(a)}>{new Date(a.scheduledAt).toLocaleString()}</button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleCreate}>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          required
        />
        <input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button type="submit">Create appointment</button>
      </form>
    </section>
  );
}

function TraceView({ appointmentId }: { appointmentId: string }) {
  const [trace, setTrace] = useState<Awaited<ReturnType<typeof api.getTrace>> | null>(null);

  useEffect(() => {
    api.getTrace(appointmentId).then(setTrace);
  }, [appointmentId]);

  if (!trace) return <section className="panel">Loading trace…</section>;

  return (
    <section className="panel">
      <h2>Full traceability chain</h2>
      <p>
        This appointment is unambiguously traceable back through its case and device to one
        customer:
      </p>
      <pre>{JSON.stringify(trace, null, 2)}</pre>
    </section>
  );
}
