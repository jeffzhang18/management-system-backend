export interface ApiResponse<T = any> {
    code: number;
    message: string
    data: T|null
    timestamp: number
    path: string
}