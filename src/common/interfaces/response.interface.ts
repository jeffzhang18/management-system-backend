export interface ApiResponse<T = any> {
    status: number;
    message: string
    data: T|null
    timestamp: number
    path: string
}