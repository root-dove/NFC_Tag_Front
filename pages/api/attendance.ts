import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "PUT") {
    try {
      const response = await fetch(`${process.env.API_BASE_URL}/attendance`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const contentType = response.headers.get("content-type")
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json()
        res.status(200).json(data)
      } else {
        const text = await response.text()
        res.status(200).json({ message: text })
      }
    } catch (error) {
      console.error("Error updating attendance:", error)
      res.status(500).json({ message: "Failed to update attendance", error: error })
    }
  } else {
    res.setHeader("Allow", ["PUT"])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}

