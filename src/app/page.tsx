"use client"

import { useState, useEffect } from "react"
import {
  format,
  eachDayOfInterval,
  isBefore,
  isWeekend,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns"
import { enUS } from "date-fns/locale"
import dynamic from "next/dynamic"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// 서버 사이드에서 렌더링 하지 말란 의미
const ClientOnly = dynamic(() => Promise.resolve((props: { children: React.ReactNode }) => <>{props.children}</>), {
  ssr: false,
})

// type script로 지정정
type AttendanceStatus = "Present" | "Absent" | "Vacation" | "Late" | "OfficialLeave" | "Not Yet"

// 근로자 구조체 지정
type Employee = {
  id: number
  name: string
  remainingVacationDays: number
  accumulatedFine: number
}

// Mock data function to simulate fetching from backend
// 사용자 별 출근 확인 코드드
const fetchAttendanceData = (start: Date, end: Date) => {
  //시작 날짜 끝 날짜 넣고 평일만 추출한 배열 생성성
  const weekDays = eachDayOfInterval({ start, end }).filter((day) => !isWeekend(day))
  const today = new Date()

  //직원 배열을 구조체로 받기
  //이걸 백앤드에서 받아줘야함
  const employees: Employee[] = [
    { id: 1, name: "John Doe", remainingVacationDays: 3, accumulatedFine: 50000 },
    { id: 2, name: "Jane Smith", remainingVacationDays: 5, accumulatedFine: 30000 },
    { id: 3, name: "Bob Johnson", remainingVacationDays: 1, accumulatedFine: 75000 },
  ]

  //직원 번호와 index번호(날짜 순번)를 넣고 해당 날짜에 출근했는지 배열로 전달 하는 함수수
  const getStatus = (
    employeeId: number,
    index: number,
  ): { status: AttendanceStatus; checkInTime?: string; comment?: string } => { // ?는 없을 수 있을때 사용용
    if (!isBefore(weekDays[index], today)) return { status: "Not Yet" } //순번 날짜가 오늘보다 다음날이면 not Yet

    switch (employeeId) {
      case 1: // John Doe
        return index % 10 === 0 ? { status: "Vacation" } : { status: "Present", checkInTime: "09:40" }
      case 2: // Jane Smith
        return index % 5 === 0 ? { status: "Late", checkInTime: "10:15" } : { status: "Absent" }
      case 3: // Bob Johnson
        const statuses: AttendanceStatus[] = ["Present", "Absent", "Late", "Vacation", "OfficialLeave"]
        const status = statuses[index % 5]
        return status === "Present"
          ? { status, checkInTime: "09:50" }
          : status === "Late"
            ? { status, checkInTime: "10:15" }
            : { status }
      default:
        return { status: "Not Yet" }
    }
  }

  return employees.map((employee) => ({
    ...employee, // 깊은 배열 복사
    attendance: weekDays.map((date, index) => { //weekDays 배열의 값을 하나씩 data와 index 번호를 가져와서 map 구현현
      const { status, checkInTime } = getStatus(employee.id, index)
      return { date, status, checkInTime }
    }),
  }))
}

type ViewMode = "day" | "week" | "month" | "all"

export default function AttendancePage() {
  const [attendanceData, setAttendanceData] = useState<any[]>([])
  const [editDate, setEditDate] = useState<Date | null>(null)
  const [editEmployeeId, setEditEmployeeId] = useState<number | null>(null)
  const [editStatus, setEditStatus] = useState<AttendanceStatus>("Present")
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(),
    to: new Date(),
  })
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [isLoading, setIsLoading] = useState(true)
  const [showFines, setShowFines] = useState<{ [key: number]: boolean }>({})

  useEffect(() => {
    setIsLoading(true)
    const data = fetchAttendanceData(dateRange.from, dateRange.to)
    setAttendanceData(data)
    setIsLoading(false)
  }, [dateRange.from, dateRange.to])

  const handleViewModeChange = (mode: ViewMode) => {
    const today = new Date()
    let newFrom: Date, newTo: Date

    switch (mode) {
      case "day":
        newFrom = today
        newTo = today
        break
      case "week":
        newFrom = startOfWeek(today)
        newTo = endOfWeek(today)
        break
      case "month":
        newFrom = startOfMonth(today)
        newTo = endOfMonth(today)
        break
      case "all":
        newFrom = subMonths(today, 12) // Show last 12 months
        newTo = today
        break
    }

    setViewMode(mode)
    setDateRange({ from: newFrom, to: newTo })
  }

  const handleEdit = (employeeId: number, date: Date, status: AttendanceStatus, comment?: string) => {
    if (status !== "Not Yet") {
      setEditEmployeeId(employeeId)
      setEditDate(date)
      setEditStatus(status)
    }
  }

  const saveEdit = () => {
    if (editEmployeeId && editDate && editStatus) {
      setAttendanceData((prevData) =>
        prevData.map((employee) =>
          employee.id === editEmployeeId
            ? {
                ...employee,
                attendance: employee.attendance.map((a: any) =>
                  a.date.getTime() === editDate.getTime() ? { ...a, status: editStatus } : a,
                ),
              }
            : employee,
        ),
      )
      setEditEmployeeId(null)
      setEditDate(null)
      setEditStatus("Present")
    }
  }

  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case "Present":
        return "bg-green-100 hover:bg-green-200"
      case "Absent":
        return "bg-red-100 hover:bg-red-200"
      case "Vacation":
        return "bg-blue-100 hover:bg-blue-200"
      case "Late":
        return "bg-yellow-100 hover:bg-yellow-200"
      case "OfficialLeave":
        return "bg-purple-100 hover:bg-purple-200"
      default:
        return "bg-black text-white hover:bg-gray-800"
    }
  }

  const handleVacationDayChange = (employeeId: number, change: number) => {
    setAttendanceData((prevData) =>
      prevData.map((employee) =>
        employee.id === employeeId
          ? {
              ...employee,
              remainingVacationDays: Math.max(0, employee.remainingVacationDays + change),
            }
          : employee,
      ),
    )
  }

  const toggleFine = (employeeId: number) => {
    setShowFines((prev) => ({ ...prev, [employeeId]: !prev[employeeId] }))
  }

  return (
    <ClientOnly>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Employee Attendance</h1>
        <div className="flex space-x-4 mb-4">
          <Button variant={viewMode === "day" ? "default" : "outline"} onClick={() => handleViewModeChange("day")}>
            Today
          </Button>
          <Button variant={viewMode === "week" ? "default" : "outline"} onClick={() => handleViewModeChange("week")}>
            This Week
          </Button>
          <Button variant={viewMode === "month" ? "default" : "outline"} onClick={() => handleViewModeChange("month")}>
            This Month
          </Button>
          <Button variant={viewMode === "all" ? "default" : "outline"} onClick={() => handleViewModeChange("all")}>
            All Time
          </Button>
        </div>
        {!isLoading ? (
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap w-32">정회원</TableHead>
                <TableHead className="whitespace-nowrap w-32">남은 휴가</TableHead>
                <TableHead className="w-64"></TableHead>
                {attendanceData[0]?.attendance.map((a: any) => (
                  <TableHead key={a.date.toISOString()}>{format(a.date, "EEE, MMM d", { locale: enUS })}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceData.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="w-32 cursor-pointer" onClick={() => toggleFine(employee.id)}>
                    <div className="flex flex-col">
                      <div>{employee.name}</div>
                      {showFines[employee.id] && (
                        <div className="text-sm text-gray-500">벌금: {employee.accumulatedFine.toLocaleString()}원</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="w-32">{employee.remainingVacationDays.toFixed(1)}일</TableCell>
                  <TableCell className="w-64 whitespace-nowrap">
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-500 hover:text-green-700 border-green-500 hover:border-green-700"
                        onClick={() => handleVacationDayChange(employee.id, 1)}
                      >
                        +1
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-500 hover:text-green-700 border-green-500 hover:border-green-700"
                        onClick={() => handleVacationDayChange(employee.id, 0.5)}
                      >
                        +0.5
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 hover:text-red-700 border-red-500 hover:border-red-700"
                        onClick={() => handleVacationDayChange(employee.id, -0.5)}
                        disabled={employee.remainingVacationDays < 0.5}
                      >
                        -0.5
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 hover:text-red-700 border-red-500 hover:border-red-700"
                        onClick={() => handleVacationDayChange(employee.id, -1)}
                        disabled={employee.remainingVacationDays < 1}
                      >
                        -1
                      </Button>
                    </div>
                  </TableCell>
                  {employee.attendance.map((a: any) => (
                    <TableCell key={a.date.toISOString()}>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            className={cn("w-full", getStatusColor(a.status))}
                            onClick={() => handleEdit(employee.id, a.date, a.status)}
                            disabled={a.status === "Not Yet"}
                          >
                            {a.status === "Not Yet" ? (
                              ""
                            ) : (
                              <>
                                {a.status}
                                {a.checkInTime && <span className="ml-2 text-xs">({a.checkInTime})</span>}
                                {a.status === "OfficialLeave" && a.comment && (
                                  <span className="ml-2 text-xs">({a.comment})</span>
                                )}
                              </>
                            )}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Attendance</DialogTitle>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="name" className="text-right">
                                Employee
                              </Label>
                              <Input id="name" value={employee.name} className="col-span-3" readOnly />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="date" className="text-right">
                                Date
                              </Label>
                              <Input
                                id="date"
                                value={format(a.date, "EEEE, MMMM d, yyyy", { locale: enUS })}
                                className="col-span-3"
                                readOnly
                              />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="status" className="text-right">
                                Status
                              </Label>
                              <select
                                id="status"
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value as AttendanceStatus)}
                                className="col-span-3 p-2 border rounded"
                              >
                                <option value="Present">Present</option>
                                <option value="Absent">Absent</option>
                                <option value="Vacation">Vacation</option>
                                <option value="Late">Late</option>
                                <option value="OfficialLeave">Official Leave</option>
                              </select>
                            </div>
                            {(editStatus === "Present" || editStatus === "Late") && (
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="checkInTime" className="text-right">
                                  Check-in Time (24h)
                                </Label>
                                <Input
                                  id="checkInTime"
                                  type="time"
                                  value={a.checkInTime || ""}
                                  onChange={(e) => {
                                    console.log("New check-in time:", e.target.value)
                                  }}
                                  className="col-span-3"
                                  step="60"
                                />
                              </div>
                            )}
                            {editStatus === "OfficialLeave" && (
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="leaveComment" className="text-right">
                                  Leave Comment
                                </Label>
                                <Input
                                  id="leaveComment"
                                  type="text"
                                  placeholder="Enter reason for official leave"
                                  className="col-span-3"
                                />
                              </div>
                            )}
                          </div>
                          <DialogFooter>
                            <Button onClick={saveEdit}>Save Changes</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p>Loading...</p>
        )}
      </div>
    </ClientOnly>
  )
}

