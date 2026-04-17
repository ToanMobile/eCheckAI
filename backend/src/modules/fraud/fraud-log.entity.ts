import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum FraudType {
  VPN_DETECTED = 'vpn_detected',
  MOCK_LOCATION = 'mock_location',
  DEVICE_MISMATCH = 'device_mismatch',
  WIFI_MISMATCH = 'wifi_mismatch',
  OUTSIDE_GEOFENCE = 'outside_geofence',
  OUTSIDE_SCHEDULE_WINDOW = 'outside_schedule_window',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SERVER_IP_VPN = 'server_ip_vpn',
  DEVICE_FARMING = 'device_farming',
}

export enum FraudSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('fraud_logs')
@Index('idx_fraud_logs_employee_id', ['employeeId'])
@Index('idx_fraud_logs_fraud_type', ['fraudType'])
@Index('idx_fraud_logs_severity', ['severity'])
export class FraudLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @Column({ name: 'attendance_id', type: 'uuid', nullable: true })
  attendanceId!: string | null; // NO FK constraint - partitioned table

  @Column({ name: 'fraud_type', type: 'enum', enum: FraudType })
  fraudType!: FraudType;

  @Column({
    name: 'severity',
    type: 'enum',
    enum: FraudSeverity,
    default: FraudSeverity.MEDIUM,
  })
  severity!: FraudSeverity;

  @Column({ name: 'details', type: 'jsonb', default: {} })
  details!: Record<string, unknown>;

  @Column({ name: 'ip_address', length: 45, nullable: true, type: 'varchar' })
  ipAddress!: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy!: string | null;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
