import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from '../employee/employee.entity';
import { Branch } from '../branch/branch.entity';

export enum AttendanceStatus {
  ON_TIME = 'on_time',
  LATE = 'late',
  EARLY_LEAVE = 'early_leave',
  ABSENT = 'absent',
  PENDING = 'pending',
}

export enum CheckType {
  AUTO_CHECKIN = 'auto_checkin',
  AUTO_CHECKOUT = 'auto_checkout',
  MANUAL = 'manual',
}

export interface LocationSnapshot {
  latitude: number;
  longitude: number;
  accuracy: number;
  wifi_bssid: string | null;
  wifi_ssid: string | null;
  is_vpn_active: boolean;
  is_mock_location: boolean;
}

export interface DeviceSnapshot {
  device_id: string;
  device_model: string;
  os_version: string;
  app_version: string;
}

@Entity('attendance_records')
@Index('idx_attendance_employee_checkin', ['employeeId', 'checkIn'])
@Index('idx_attendance_branch_date', ['branchId', 'workDate'])
@Index('idx_attendance_status', ['status'])
export class AttendanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ name: 'branch_id', type: 'uuid' })
  branchId!: string;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch!: Branch;

  @Column({ name: 'work_date', type: 'date' })
  workDate!: string;

  @Column({ name: 'check_in', type: 'timestamptz', nullable: true })
  checkIn!: Date | null;

  @Column({ name: 'check_out', type: 'timestamptz', nullable: true })
  checkOut!: Date | null;

  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    default: AttendanceStatus.ABSENT,
  })
  status!: AttendanceStatus;

  @Column({
    name: 'type',
    type: 'enum',
    enum: CheckType,
  })
  checkType!: CheckType;

  @Column({ name: 'location_snapshot', type: 'jsonb', nullable: true })
  locationSnapshot!: LocationSnapshot | null;

  @Column({ name: 'device_snapshot', type: 'jsonb', nullable: true })
  deviceSnapshot!: DeviceSnapshot | null;

  @Column({ name: 'schedule_id', type: 'uuid', nullable: true })
  scheduleId!: string | null;

  @Column({ nullable: true, type: 'text' })
  note!: string | null;

  @Column({ name: 'is_flagged', default: false })
  isFraudFlagged!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
