"use client"

import { useState, useEffect } from "react"
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  eachDayOfInterval,
  isWeekend,
} from "date-fns"
import { enUS } from "date-fns/locale"
import dynamic from "next/dynamic"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const ClientOnly = dynamic(() => Promise.resolve((props: { children: React.ReactNode }) => <>{props.children}</>), {
  ssr: false,
})

type AttendanceStatus = "PRESENT" | "ABSENT" | "VACATION" | "LATE" | "OFFICIAL_LEAVE" | "NOT_YET"

type Employee = {
  id: number
  name: string
  remainingLeaveDays: number
  latePenaltyPoints: number
}

type AttendanceRecord = {
  attendanceDate: string
  status: AttendanceStatus
  time?: string
  comment?: string
}

type ViewMode = "day" | "week" | "month" | "all"

const API_BASE_URL = process.env.API_BASE_URL // Replace with your actual API base URL

export default function AttendancePage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [attendanceData, setAttendanceData] = useState<{ [key: number]: AttendanceRecord[] }>({})
  const [editDate, setEditDate] = useState<string | null>(null)
  const [editEmployeeId, setEditEmployeeId] = useState<number | null>(null)
  const [editStatus, setEditStatus] = useState<AttendanceStatus>("PRESENT")
  const [editTime, setEditTime] = useState<string>("")
  const [editComment, setEditComment] = useState<string>("")
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfWeek(new Date()),
    to: endOfWeek(new Date()),
  })
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [isLoading, setIsLoading] = useState(true)
  const [showPenalties, setShowPenalties] = useState<{ [key: number]: boolean }>({})

  useEffect(() => {
    fetchEmployees()
    fetchAttendanceData()
  }, [dateRange, viewMode]) //Corrected useEffect dependency

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users`)
      if (!response.ok) throw new Error("Failed to fetch employees")
      const data = await response.json()
      setEmployees(data)
    } catch (error) {
      console.error("Error fetching employees:", error)
    }
  }

  const fetchAttendanceData = async () => {
    setIsLoading(true)
    try {
      const promises = employees.map((employee) =>
        fetch(
          `${API_BASE_URL}/attendance/records?userId=${employee.id}&startDate=${format(dateRange.from, "yyyy-MM-dd")}&endDate=${format(dateRange.to, "yyyy-MM-dd")}`,
        )
          .then((response) => {
            if (!response.ok) throw new Error("Failed to fetch attendance data")
            return response.json()
          })
          .then((data) => ({ [employee.id]: data })),
      )
      const results = await Promise.all(promises)
      const combinedData = Object.assign({}, ...results)
      setAttendanceData(combinedData)
    } catch (error) {
      console.error("Error fetching attendance data:", error)
    } finally {
      setIsLoading(false)
    }
  }

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

  const handleEdit = (employeeId: number, date: string, status: AttendanceStatus, time?: string, comment?: string) => {
    setEditEmployeeId(employeeId)
    setEditDate(date)
    setEditStatus(status)
    setEditTime(time || "")
    setEditComment(comment || "")
  }

  const saveEdit = async () => {
    if (editEmployeeId && editDate && editStatus) {
      try {
        const requestBody = {
          userId: editEmployeeId,
          attendanceDate: editDate,
          status: editStatus,
          comment: editComment,
          time: editTime,
        }
        console.log("Request body:", requestBody)
  
        const response = await fetch("/api/attendance", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        })
  
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
        }
  
        const data = await response.json()
        console.log("Server response:", data)
  
        // Refresh attendance data
        fetchAttendanceData()
  
        // Reset edit state
        setEditEmployeeId(null)
        setEditDate(null)
        setEditStatus("PRESENT")
        setEditTime("")
        setEditComment("")
      } catch (error) {
        console.error("Error updating attendance:", error)
        alert(`Failed to update attendance: ${error}`)
      }
    }
  }
  
  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case "PRESENT":
        return "bg-green-100 hover:bg-green-200"
      case "ABSENT":
        return "bg-red-100 hover:bg-red-200"
      case "VACATION":
        return "bg-blue-100 hover:bg-blue-200"
      case "LATE":
        return "bg-yellow-100 hover:bg-yellow-200"
      case "OFFICIAL_LEAVE":
        return "bg-purple-100 hover:bg-purple-200"
      default:
        return "bg-gray-100 hover:bg-gray-200"
    }
  }

  const handleVacationDayChange = async (employeeId: number, change: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/attendance/${employeeId}/vacation-days`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ change }),
      })

      if (!response.ok) throw new Error("Failed to update vacation days")

      // Refresh employee data
      fetchEmployees()
    } catch (error) {
      console.error("Error updating vacation days:", error)
    }
  }

  const togglePenalty = (employeeId: number) => {
    setShowPenalties((prev) => ({ ...prev, [employeeId]: !prev[employeeId] }))
  }

  const dateRangeArray = eachDayOfInterval({ start: dateRange.from, end: dateRange.to }).filter(
    (date) => !isWeekend(date),
  )

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
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap w-32">정회원</TableHead>
                <TableHead className="whitespace-nowrap w-32">남은 휴가</TableHead>
                <TableHead className="w-64"></TableHead>
                {dateRangeArray.map((date) => (
                  <TableHead key={date.toISOString()}>{format(date, "EEE, MMM d", { locale: enUS })}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="w-32 cursor-pointer" onClick={() => togglePenalty(employee.id)}>
                    <div className="flex flex-col">
                      <div>{employee.name}</div>
                      {showPenalties[employee.id] && (
                        <div className="text-sm text-gray-500">벌점: {employee.latePenaltyPoints}점</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="w-32">{employee.remainingLeaveDays.toFixed(1)}일</TableCell>
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
                        disabled={employee.remainingLeaveDays < 0.5}
                      >
                        -0.5
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 hover:text-red-700 border-red-500 hover:border-red-700"
                        onClick={() => handleVacationDayChange(employee.id, -1)}
                        disabled={employee.remainingLeaveDays < 1}
                      >
                        -1
                      </Button>
                    </div>
                  </TableCell>
                  {dateRangeArray.map((date) => {
                    const record = attendanceData[employee.id]?.find(
                      (r) => r.attendanceDate === format(date, "yyyy-MM-dd"),
                    ) || { status: "NOT_YET" as AttendanceStatus }
                    return (
                      <TableCell key={date.toISOString()}>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              className={cn("w-full", getStatusColor(record.status))}
                              onClick={() =>
                                handleEdit(
                                  employee.id,
                                  format(date, "yyyy-MM-dd"),
                                  record.status,
                                  "time" in record ? record.time : undefined,
                                  "comment" in record ? record.comment : undefined,
                                )
                              }
                            >
                              {record.status === "NOT_YET" ? (
                                ""
                              ) : (
                                <>
                                  {record.status}
                                  {"time" in record && record.time && (
                                    <span className="ml-2 text-xs">({record.time})</span>
                                  )}
                                  {record.status === "OFFICIAL_LEAVE" && "comment" in record && record.comment && (
                                    <span className="ml-2 text-xs">({record.comment})</span>
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
                                  value={format(date, "EEEE, MMMM d, yyyy", { locale: enUS })}
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
                                  <option value="PRESENT">Present</option>
                                  <option value="ABSENT">Absent</option>
                                  <option value="VACATION">Vacation</option>
                                  <option value="LATE">Late</option>
                                  <option value="OFFICIAL_LEAVE">Official Leave</option>
                                </select>
                              </div>
                              {(editStatus === "PRESENT" || editStatus === "LATE") && (
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label htmlFor="checkInTime" className="text-right">
                                    Check-in Time (24h)
                                  </Label>
                                  <Input
                                    id="checkInTime"
                                    type="time"
                                    value={editTime}
                                    onChange={(e) => setEditTime(e.target.value)}
                                    className="col-span-3"
                                    step="60"
                                  />
                                </div>
                              )}
                              {editStatus === "OFFICIAL_LEAVE" && (
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label htmlFor="leaveComment" className="text-right">
                                    Leave Comment
                                  </Label>
                                  <Input
                                    id="leaveComment"
                                    type="text"
                                    value={editComment}
                                    onChange={(e) => setEditComment(e.target.value)}
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
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </ClientOnly>
  )
}

