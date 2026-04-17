import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';

export enum EmployeeRole {
  EMPLOYEE = 'employee',
  BRANCH_MANAGER = 'branch_manager',
  HR = 'hr',
  SUPER_ADMIN = 'super_admin',
}

@Entity('employees')
@Index('idx_employees_email', ['email'])
@Index('idx_employees_code', ['employeeCode'])
@Index('idx_employees_branch', ['branchId'])
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'employee_code', unique: true, length: 50 })
  employeeCode!: string;

  @Column({ name: 'full_name', length: 255 })
  fullName!: string;

  @Column({ unique: true, length: 255 })
  email!: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash!: string;

  @Column({ name: 'phone', nullable: true, type: 'varchar', length: 20 })
  phoneNumber!: string | null;

  @Column({
    type: 'enum',
    enum: EmployeeRole,
    default: EmployeeRole.EMPLOYEE,
  })
  role!: EmployeeRole;

  @Column({ name: 'branch_id', nullable: true, type: 'uuid' })
  branchId!: string | null;

  @ManyToOne('Branch', 'employees', {
    nullable: true,
    onDelete: 'SET NULL',
    lazy: true,
  })
  @JoinColumn({ name: 'branch_id' })
  branch!: Promise<import('../branch/branch.entity').Branch | null>;

  @OneToMany('AttendanceRecord', 'employee', { lazy: true })
  attendanceRecords!: Promise<unknown[]>;

  @Column({ name: 'registered_device_id', nullable: true, type: 'varchar', length: 255 })
  registeredDeviceId!: string | null;

  @Column({ name: 'device_registered_at', nullable: true, type: 'timestamptz' })
  deviceRegisteredAt!: Date | null;

  @Column({ name: 'refresh_token_hash', nullable: true, type: 'varchar', length: 255 })
  refreshTokenHash!: string | null;

  @Column({ name: 'refresh_token_expires', nullable: true, type: 'timestamptz' })
  refreshTokenExpires!: Date | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'last_login_at', nullable: true, type: 'timestamptz' })
  lastLoginAt!: Date | null;

  @Column({ name: 'deleted_at', nullable: true, type: 'timestamptz' })
  deletedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
