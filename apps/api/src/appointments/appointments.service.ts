import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
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

  async create(input: CreateAppointmentInput, actorUserId: string) {
    const caseRecord = await this.db.query.cases.findFirst({ where: eq(cases.id, input.caseId) });
    if (!caseRecord) throw new NotFoundException("Case not found.");

    const appointment = single(
      await this.db
        .insert(appointments)
        .values({
          ...input,
          scheduledAt: new Date(input.scheduledAt),
          createdBy: actorUserId,
          updatedBy: actorUserId,
        })
        .returning(),
    );

    const organizationId = await this.resolveOrganizationId(caseRecord.assistiveDeviceId);
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

  findByCase(caseId: string) {
    return this.db.query.appointments.findMany({ where: eq(appointments.caseId, caseId) });
  }

  async findOne(id: string) {
    const appointment = await this.db.query.appointments.findFirst({
      where: eq(appointments.id, id),
    });
    if (!appointment) throw new NotFoundException("Appointment not found.");
    return appointment;
  }

  // Full Customer -> AssistiveDevice -> Case -> Appointment traceability
  // chain, resolved with explicit sequential lookups rather than a Drizzle
  // relational `with` query, keeping each hop plain and auditable.
  async trace(id: string) {
    const appointment = await this.findOne(id);
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

  private async resolveOrganizationId(assistiveDeviceId: string): Promise<string | null> {
    const device = await this.db.query.assistiveDevices.findFirst({
      where: eq(assistiveDevices.id, assistiveDeviceId),
    });
    if (!device) return null;
    const customer = await this.db.query.customers.findFirst({ where: eq(customers.id, device.customerId) });
    return customer?.organizationId ?? null;
  }
}
