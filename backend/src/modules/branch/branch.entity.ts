import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('branches')
@Index('idx_branches_code', ['code'])
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 20 })
  code!: string;

  @Column({ length: 150 })
  name!: string;

  @Column({ length: 255 })
  address!: string;

  /** Latitude of branch center */
  @Column({ name: 'latitude', type: 'decimal', precision: 10, scale: 8 })
  latitude!: number;

  /** Longitude of branch center */
  @Column({ name: 'longitude', type: 'decimal', precision: 11, scale: 8 })
  longitude!: number;

  /** Allowed GPS radius in meters */
  @Column({ name: 'radius_meters', type: 'int', default: 100 })
  radiusMeters!: number;

  /**
   * Array of allowed WiFi BSSIDs (e.g. ["AA:BB:CC:DD:EE:FF"])
   * Stored as JSONB for fast lookup
   */
  @Column({ name: 'wifi_bssids', type: 'jsonb', default: [] })
  wifiBssids!: string[];

  /** Human-readable WiFi SSIDs (informational) */
  @Column({ name: 'wifi_ssids', type: 'jsonb', default: [] })
  wifiSsids!: string[];

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'timezone', length: 50, default: 'Asia/Ho_Chi_Minh' })
  timezone!: string;

  @OneToMany('Employee', 'branch', { lazy: true })
  employees!: Promise<import('../employee/employee.entity').Employee[]>;

  @OneToMany('WorkSchedule', 'branch', { lazy: true })
  schedules!: Promise<unknown[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', nullable: true, type: 'timestamptz' })
  deletedAt!: Date | null;
}
