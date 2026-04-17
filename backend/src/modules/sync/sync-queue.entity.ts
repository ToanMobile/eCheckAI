import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SyncStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum SyncEventType {
  AUTO_CHECKIN = 'auto_checkin',
  AUTO_CHECKOUT = 'auto_checkout',
  MANUAL_CHECKIN = 'manual_checkin',
}

@Entity('sync_queue')
@Index('idx_sync_employee_status', ['employeeId', 'status'])
@Index('idx_sync_created', ['createdAt'])
export class SyncQueueItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: SyncEventType,
  })
  eventType!: SyncEventType;

  @Column({ name: 'payload', type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: SyncStatus,
    default: SyncStatus.PENDING,
  })
  status!: SyncStatus;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount!: number;

  @Column({ name: 'error_message', nullable: true, type: 'text' })
  errorMessage!: string | null;

  @Column({ name: 'processed_at', nullable: true, type: 'timestamptz' })
  processedAt!: Date | null;

  @Column({ name: 'attendance_record_id', type: 'uuid', nullable: true })
  attendanceRecordId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
