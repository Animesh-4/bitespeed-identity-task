import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Identity Reconciliation API is running.');
});

app.post('/identify', async (req: Request, res: Response) => {
  const { email, phoneNumber } = req.body;

  const strPhoneNumber = phoneNumber ? String(phoneNumber) : null;
  const strEmail = email ? String(email) : null;

  if (!strEmail && !strPhoneNumber) {
    return res.status(400).json({ error: "Either email or phoneNumber must be provided." });
  }

  try {
    const queryConditions = [];
    if (strEmail) queryConditions.push({ email: strEmail });
    if (strPhoneNumber) queryConditions.push({ phoneNumber: strPhoneNumber });

    const matchingContacts = await prisma.contact.findMany({
      where: {
        OR: queryConditions,
      },
    });

    // SCENARIO 1: Brand New Customer
    if (matchingContacts.length === 0) {
      const newContact = await prisma.contact.create({
        data: {
          email: strEmail,
          phoneNumber: strPhoneNumber,
          linkPrecedence: "primary",
        },
      });

      return res.status(200).json({
        contact: {
          primaryContatctId: newContact.id,
          emails: newContact.email ? [newContact.email] : [],
          phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
          secondaryContactIds: [],
        },
      });
    }

    // SCENARIO 4: Merging existing customers
    const rootContactIds = new Set<number>();
    matchingContacts.forEach((c) => {
      if (c.linkedId) rootContactIds.add(c.linkedId);
      else rootContactIds.add(c.id);
    });

    const rootContacts = await prisma.contact.findMany({
      where: { id: { in: Array.from(rootContactIds) } },
      orderBy: { createdAt: 'asc' },
    });

    const primaryContact = rootContacts[0];
    
    if (!primaryContact) {
      return res.status(500).json({ error: "Data integrity error: No primary contact found." });
    }

    const newerPrimaryContacts = rootContacts.slice(1);

    if (newerPrimaryContacts.length > 0) {
      for (const newerPrimary of newerPrimaryContacts) {
        await prisma.contact.update({
          where: { id: newerPrimary.id },
          data: {
            linkedId: primaryContact.id,
            linkPrecedence: "secondary",
          },
        });

        await prisma.contact.updateMany({
          where: { linkedId: newerPrimary.id },
          data: { linkedId: primaryContact.id },
        });
      }
    }

    // SCENARIOS 2 & 3: Is there new info?
    const existingEmails = new Set(matchingContacts.map((c) => c.email).filter(Boolean));
    const existingPhones = new Set(matchingContacts.map((c) => c.phoneNumber).filter(Boolean));

    const isNewEmail = strEmail && !existingEmails.has(strEmail);
    const isNewPhone = strPhoneNumber && !existingPhones.has(strPhoneNumber);

    if (isNewEmail || isNewPhone) {
      await prisma.contact.create({
        data: {
          email: strEmail,
          phoneNumber: strPhoneNumber,
          linkedId: primaryContact.id,
          linkPrecedence: "secondary",
        },
      });
    }

    // FINAL STEP: Build the Consolidated Payload
    const allLinkedContacts = await prisma.contact.findMany({
      where: {
        OR: [
          { id: primaryContact.id },
          { linkedId: primaryContact.id }
        ]
      },
      orderBy: { createdAt: 'asc' },
    });

    const emails = Array.from(new Set(allLinkedContacts.map((c) => c.email).filter(Boolean))) as string[];
    const phoneNumbers = Array.from(new Set(allLinkedContacts.map((c) => c.phoneNumber).filter(Boolean))) as string[];
    const secondaryContactIds = allLinkedContacts.filter((c) => c.id !== primaryContact.id).map((c) => c.id);

    return res.status(200).json({
      contact: {
        primaryContatctId: primaryContact.id,
        emails: emails,
        phoneNumbers: phoneNumbers,
        secondaryContactIds: secondaryContactIds,
      },
    });

  } catch (error) {
    console.error("Error identifying contact:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});