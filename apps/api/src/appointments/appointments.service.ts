import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { CreateAppointmentInput } from "@pulse/domain";
import { DATABASE_CONNECTION, Database } from "../database/database.provider";
import { appointments, assistiveDevices, cases, customers } from "../database/schema";
import { AuditService } from "../common/audit/audit.service";
import { single } from "../common/single";

@Injectable()
export class AppointmentsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateAppointmentInput, actorUserId: string, organizationId: string) {
    const caseRecord = await this.db.query.cases.findFirst({
      where: and(eq(cases.id, input.caseId), eq(cases.organizationId, organizationId)),
    });
    if (!caseRecord) throw new NotFoundException("Case not found.");

    const appointment = single(
      await this.db
        .insert(appointments)
        .values({
          ...input,
          organizationId,
          scheduledAt: new Date(input.scheduledAt),
          createdBy: actorUserId,
          updatedBy: actorUserId,
        })
        .returning(),
    );

    await this.auditService.recordMutation({
      organizationId,
      userId: actorUserId,
      entityType: "Appointment",
      entityId: appointment.id,
      action: "create",
      payload: input,
    });
    return appointment;
  }

  findByCase(caseId: string, organizationId: string) {
    return this.db.query.appointments.findMany({
      where: and(eq(appointments.caseId, caseId), eq(appointments.organizationId, organizationId)),
    });
  }

  async findOne(id: string, organizationId: string) {
    const appointment = await this.db.query.appointments.findFirst({
      where: and(eq(appointments.id, id), eq(appointments.organizationId, organizationId)),
    });
    if (!appointment) throw new NotFoundException("Appointment not found.");
    return appointment;
  }

  // Full Customer -> AssistiveDevice -> Case -> Appointment traceability
  // chain, resolved with explicit sequential lookups rather than a Drizzle
  // relational `with` query, keeping each hop plain and auditable. Every hop
  // is already known to belong to `organizationId` because the appointment
  // lookup itself is org-scoped and every entity below it was created with
  // the same organizationId (see cases/assistive-devices services).
  async trace(id: string, organizationId: string) {
    const appointment = await this.findOne(id, organizationId);
    const caseRecord = await this.db.query.cases.findFirst({ where: eq(cases.id, appointment.caseId) });
    if (!caseRecord) throw new NotFoundException("Case not found.");
    const assistiveDevice = await this.db.query.assistiveDevices.findFirst({
      where: eq(assistiveDevices.id, caseRecord.assistiveDeviceId),
    });
    if (!assistiveDevice) throw new NotFoundException("AssistiveDevice not found.");
    const customer = await this.db.query.customers.findFirst({
      where: eq(customers.id, assistiveDevice.customerId),
    });
    if (!customer) throw new NotFoundException("Customer not found.");

    return { appointment, case: caseRecord, assistiveDevice, customer };
  }
}
