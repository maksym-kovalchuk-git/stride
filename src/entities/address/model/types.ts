export type Address = {
  id: string
  user_id: string | null
  recipient_first_name: string | null
  recipient_last_name: string | null
  phone: string
  np_city_name: string
  np_city_ref: string
  np_branch_name: string
  np_branch_ref: string
  is_default: boolean
}