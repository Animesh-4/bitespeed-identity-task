# Bitespeed Backend Task: Identity Reconciliation

A Node.js web service designed to track and consolidate customer identities across multiple purchases on FluxKart.com. This API solves the "Identity Resolution" problem by linking incoming orders to existing customers based on shared email addresses or phone numbers, ensuring a seamless and personalized customer experience.

## 🚀 Live Demo

The service is deployed and hosted on Render.

**Live Endpoint:** `POST https://identity-task-l7c2.onrender.com/identify`

## 🛠️ Tech Stack

* **Runtime:** Node.js
* **Language:** TypeScript
* **Framework:** Express.js
* **Database:** PostgreSQL
* **ORM:** Prisma
* **Hosting:** Render.com

## 📖 API Documentation

### Identify Contact
Retrieves or creates a consolidated contact profile based on an incoming email and/or phone number.

* **URL:** `/identify`
* **Method:** `POST`
* **Headers:** `Content-Type: application/json`

#### Request Body
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
