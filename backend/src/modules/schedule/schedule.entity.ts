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
import { Branch } from '../branch/branch.entity';

@Entity('schedules')
@Index('idx_schedules_branch_id', ['branchId'])
@Index('idx_schedules_branch_active', ['branchId', 'isActive'])
export class WorkSchedule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'branch_id', type: 'uuid' })
  branchId!: string;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch!: Branch;

  @Column({ name: 'name', length: 255 })
  shiftName!: string;

  /**
   * Expected check-in time in HH:MM format (Vietnam time)
   * e.g. "08:00"
   */
  @Column({ name: 'checkin_time', type: 'time' })
  checkinTime!: string;

  /**
   * Expected check-out time in HH:MM format (Vietnam time)
   * e.g. "17:30"
   */
  @Column({ name: 'checkout_time', type: 'time' })
  checkoutTime!: string;

  /**
   * Tolerance window in minutes (+/- around schedule time)
   */
  @Column({ name: 'window_minutes', type: 'int', default: 15 })
  windowMinutes!: number;

  /**
   * Days of week this schedule is active (ISO: 1=Mon, 7=Sun)
   * Stored as integer[] e.g. [1,2,3,4,5]
   */
  @Column({ name: 'active_days', type: 'int', array: true, default: [1, 2, 3, 4, 5] })
  activeDays!: number[];

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
