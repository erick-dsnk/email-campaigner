import fs from "fs";
import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

import * as emails from "./emails";
import * as logging from "./logging";
import path from "path";

type Lead = {
  name: string;
  email: string;
  companyName: string;
  websiteLink: string;
  firstLine: string;
  step: number;
  replied: boolean;
};

function getLeads(file: string): Array<Lead> {
  const data = fs.readFileSync(file, { encoding: "utf-8" });

  return JSON.parse(data);
}

function randomTime(minTime: number, maxTime: number): number {
  return Math.floor(Math.random() * (maxTime - minTime + 1) + minTime) * 60;
}

function wait(ms: number): Promise<void> {
  return new Promise((res) => {
    setTimeout(res, ms);
  });
}

class LeadQueue {
  private waiting: Array<Lead> = [];

  public getWaiting(): Array<Lead> {
    return this.waiting;
  }

  public addToWaiting(lead: Lead): Array<Lead> {
    this.waiting.push(lead);

    return this.waiting;
  }

  public removeFromWaiting(lead: Lead): void {
    this.waiting.splice(
      this.waiting.findIndex((l) => l == lead),
      1
    );
  }

  public popFromQueue(): Lead {
    return this.waiting.splice(0, 1)[0];
  }
}

class Client {
  private logger: logging.Logger;
  private transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo>;
  private queue: LeadQueue;

  private currentStep: number;

  public leads: Array<Lead>;

  constructor(
    options: {
      host: string;
      port: number;
      useSSL: boolean;
      auth: {
        user: string;
        pass: string;
      };
    },
    currentStep: number,
    loggingLevel: logging.LoggingLevel
  ) {
    this.logger = new logging.Logger(loggingLevel);

    this.logger.addLog("Initialized logger.");

    this.transporter = nodemailer.createTransport(options);

    this.logger.addLog("Initialized email transporter.");

    this.currentStep = currentStep;

    this.queue = new LeadQueue();

    this.leads = getLeads(leadsFile);

    this.logger.addDebugLog("Loaded test leads from file.");

    switch (this.currentStep) {
      case 0: {
        for (let lead of this.leads.filter((l: Lead) => l.step === 0)) {
          this.queue.addToWaiting(lead);
        }

        this.logger.addDebugLog("Added step 0 leads to queue");

        break;
      }

      case 1: {
        for (let lead of this.leads.filter((l: Lead) => l.step === 2)) {
          this.queue.addToWaiting(lead);
        }

        this.logger.addDebugLog("Added step 1 leads to queue");

        break;
      }

      case 2: {
        for (let lead of this.leads.filter((l: Lead) => l.step === 1)) {
          this.queue.addToWaiting(lead);
        }

        this.logger.addDebugLog("Added step 2 leads to queue");

        break;
      }
    }

    this.logger.addLog(
      "Loaded leads and added them to queue, prioritizing follow-up over new leads."
    );
    this.logger.addDebugLog(`${this.queue.getWaiting()}`);
  }

  public async startSend() {
    do {
      const timeToWait = randomTime(5, 12);

      let lead = this.queue.popFromQueue();

      if (lead.replied === false) {
        switch (lead.step) {
          case 0: {
            let html = emails.firstStepTemplate.content
              .replace(/{firstName}/g, lead.name.split(" ")[0])
              .replace(/{companyName}/g, lead.companyName)
              .replace(/{firstLine}/g, lead.firstLine);

            let subject = emails.firstStepTemplate.subject.replace(
              /{companyName}/g,
              lead.companyName
            );

            this.transporter
              .sendMail({
                to: lead.email,
                from: '"Eric Tabacaru" <eric@tyche.agency>',
                subject,
                html,
              })
              .then((resp) => {
                if (resp.accepted) {
                  this.logger.addLog(`Sent Step 1 Email to ${lead.email}.`);
                }
              })
              .catch((e: Error) => {
                this.logger.addErrorLog(
                  `The following error occured when trying to send an email to ${lead.email}:\n${e}`
                );
              });

            break;
          }

          case 1: {
            let html = emails.secondStepTemplate.content.replace(
              /{firstName}/g,
              lead.name.split(" ")[0]
            );

            let subject = emails.secondStepTemplate.subject.replace(
              /{firstName}/g,
              lead.name.split(" ")[0]
            );

            this.transporter
              .sendMail({
                to: lead.email,
                from: '"Eric Tabacaru" <eric@tyche.agency>',
                subject,
                html,
              })
              .then((resp) => {
                if (resp.accepted) {
                  this.logger.addLog(`Sent Step 2 Email to ${lead.email}.`);
                }
              })
              .catch((e: Error) => {
                this.logger.addErrorLog(
                  `The following error occured when trying to send an email to ${lead.email}:\n${e}`
                );
              });

            break;
          }

          case 2: {
            let html = emails.thirdStepTemplate.content.replace(
              /{firstName}/g,
              lead.name.split(" ")[0]
            );

            let subject = emails.thirdStepTemplate.subject.replace(
              /{firstName}/g,
              lead.name.split(" ")[0]
            );

            this.transporter
              .sendMail({
                to: lead.email,
                from: '"Eric Tabacaru" <eric@tyche.agency>',
                subject,
                html,
              })
              .then((resp) => {
                if (resp.accepted) {
                  this.logger.addLog(`Sent Step 3 Email to ${lead.email}.`);
                }
              })
              .catch((e: Error) => {
                this.logger.addErrorLog(
                  `The following error occured when trying to send an email to ${lead.email}:\n${e}`
                );
              });

            break;
          }
        }
      }

      this.logger.addDebugLog(
        `Waiting for ${timeToWait}s before moving on to next lead.`
      );

      await wait(timeToWait * 1000);
    } while (this.queue.getWaiting().length != 0);
  }
}

const args = process.argv.slice(2);

const user = String(args.find((v) => v.includes("--user"))?.split("=")[1]);
const pass = String(args.find((v) => v.includes("--pass"))?.split("=")[1]);
const host = String(args.find((v) => v.includes("--host"))?.split("=")[1]);
const port = Number(args.find((v) => v.includes("--port"))?.split("=")[1]);
const step = Number(args.find((v) => v.includes("--step"))?.split("=")[1]);

const leadsFile = path.resolve(
  String(args.find((v) => v.includes("--file"))?.split("=")[1])
);

let loggingLevel: logging.LoggingLevel = (function (): logging.LoggingLevel {
  let level: logging.LoggingLevel;

  switch (args.find((v) => v.includes("--logging"))?.split("=")[1]) {
    case "info":
      level = logging.LoggingLevel.INFO;
      break;
    case "debug":
      level = logging.LoggingLevel.DEBUG;
      break;
    case "error":
      level = logging.LoggingLevel.ERROR;
      break;
    default:
      level = logging.LoggingLevel.INFO;
      break;
  }

  return level;
})();

const client = new Client(
  {
    host,
    port,
    useSSL: true,
    auth: {
      user,
      pass,
    },
  },
  step,
  loggingLevel
);

client.startSend();
