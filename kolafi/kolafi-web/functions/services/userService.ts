import type { UserDto } from '../types'
import { listUsers, type UserRow } from '../repositories/userRepository'

export async function getUserList(DB: D1Database): Promise<UserDto[]> {
  const rows = await listUsers(DB)
  return rows.map(rowToDto)
}

function rowToDto(row: UserRow): UserDto {
  return {
    id: row.id,
    name: row.name,
  }
}
