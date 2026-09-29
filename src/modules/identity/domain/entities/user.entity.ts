/**
 * Entity thuan TypeScript - khong decorator ORM, khong logic hash.
 * Domain layer KHONG duoc import @nestjs/* hay prisma.
 */
export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly fullname: string,
    public readonly passwordHash: string,
    public readonly createAt: Date,
    public readonly updateAt: Date,
  ) {}
  /**
   * Dung khi tra response ra ngoai - KHONG bao gio de passwordHash lot ra DTO response.
   * Moi noi can tra User ra HTTP deu phai goi ham nay, khong tra thang entity.
   */
  toSafeObject(): {
    id: string;
    email: string;
    fullname: string;
    createAt: string;
  } {
    return {
      id: this.id,
      email: this.email,
      fullname: this.fullname,
      createAt: this.createAt.toISOString(),
    };
  }
}
