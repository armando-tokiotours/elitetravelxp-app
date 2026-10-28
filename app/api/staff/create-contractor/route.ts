import { NextResponse } from "next/server";
import sharp from "sharp";
import { getAdminPocketBase } from "@/lib/pocketbase/admin";
import {
  accountTypeForRole,
  buildContractorWelcomeMail,
  generateTempPassword,
  isContractorRole,
  loginUrlForRole,
} from "@/lib/contractorProvisioning";
import { sendTransactionalMail } from "@/lib/mail";
import {
  canAccessTeamAccess,
  isStaffRole,
  type StaffRole,
} from "@/lib/staffRoles";
import { verifyCredentialActor } from "@/lib/staffCredentialAuth";
import {
  ensureStaffProfile,
  splitDisplayNameForEditor,
  staffPhotoFilename,
  updateStaffProfile,
} from "@/lib/staffProfiles";
import {
  ensureDriverProfile,
  ensureGuideProfile,
} from "@/lib/roleProfiles";
import { writeVpsMediaFile } from "@/lib/vpsMediaStorage";

export const runtime = "nodejs";

/**
 * POST /api/staff/create-contractor
 * Owner/ops create guide | driver | agency | ticketer with server-side temp
 * password, force_password_change, optional photo/phone/bio, welcome email.
 *
 * multipart: email, name, role, phone?, bio?, agencyId?, sendWelcome?, photo?
 * (JSON body also accepted without photo.)
 */
export async function POST(request: Request) {
  try {
    const actor = await verifyCredentialActor(request);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!actor.isSuperuser && !canAccessTeamAccess(actor.role)) {
      return NextResponse.json(
        { error: "Only Owner / Ops can create contractor accounts." },
        { status: 403 }
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let email = "";
    let name = "";
    let roleRaw = "";
    let phone = "";
    let bio = "";
    let agencyId = "";
    let sendWelcome = true;
    let photoFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      email = String(form.get("email") || "").trim().toLowerCase();
      name = String(form.get("name") || "").trim();
      roleRaw = String(form.get("role") || "").trim();
      phone = String(form.get("phone") || "").trim();
      bio = String(form.get("bio") || "").trim();
      agencyId = String(form.get("agencyId") || form.get("agency_id") || "").trim();
      const sw = form.get("sendWelcome");
      sendWelcome = sw === null || sw === undefined
        ? true
        : String(sw).toLowerCase() !== "false" && String(sw) !== "0";
      const incoming = form.get("photo") || form.get("file");
      if (incoming instanceof File && incoming.size > 0) {
        photoFile = incoming;
      }
    } else {
      const body = (await request.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      email = String(body.email || "").trim().toLowerCase();
      name = String(body.name || "").trim();
      roleRaw = String(body.role || "").trim();
      phone = String(body.phone || "").trim();
      bio = String(body.bio || "").trim();
      agencyId = String(body.agencyId || body.agency_id || "").trim();
      sendWelcome = body.sendWelcome !== false;
    }

    if (!name) {
      return NextResponse.json(
        { error: "Display name is required." },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Email must look like name@company.com." },
        { status: 400 }
      );
    }
    if (!isStaffRole(roleRaw) || !isContractorRole(roleRaw)) {
      return NextResponse.json(
        {
          error:
            "Role must be guide, driver, agency, or ticketer for contractor create.",
        },
        { status: 400 }
      );
    }
    const role = roleRaw as StaffRole;
    if (role === "agency" && !agencyId) {
      return NextResponse.json(
        { error: "Agency id is required for the Agency role." },
        { status: 400 }
      );
    }

    const pb = await getAdminPocketBase();
    try {
      await pb
        .collection("staff")
        .getFirstListItem(`email="${email.replace(/"/g, "")}"`, {
          requestKey: null,
        });
      return NextResponse.json(
        {
          error:
            "This email already exists. Edit the existing user instead of creating a new one.",
        },
        { status: 409 }
      );
    } catch {
      /* not found — ok */
    }

    const tempPassword = generateTempPassword();
    const created = await pb.collection("staff").create(
      {
        email,
        password: tempPassword,
        passwordConfirm: tempPassword,
        name,
        role,
        account_type: accountTypeForRole(role),
        agency_id: role === "agency" ? agencyId : "",
        active: true,
        emailVisibility: true,
        force_password_change: true,
      },
      { requestKey: null }
    );
    const staffId = String(created.id);

    const parts = splitDisplayNameForEditor(name);
    await ensureStaffProfile(pb, staffId, {
      display_name: name,
      first_name: parts.first_name,
      last_name: parts.last_name,
    });
    await updateStaffProfile(pb, staffId, {
      ...(phone ? { phone } : {}),
      ...(bio ? { bio } : {}),
    });

    let photoSaved: string | undefined;
    let vpsPhotoUrl: string | undefined;
    if (photoFile) {
      const src = Buffer.from(await photoFile.arrayBuffer());
      const jpeg = await sharp(src)
        .rotate()
        .resize(360, 480, { fit: "cover" })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();

      const vps = await writeVpsMediaFile({
        folder: "profiles",
        fileName: `contractor-${staffId}.jpg`,
        buffer: jpeg,
      });
      vpsPhotoUrl = vps.url;

      const photo = new File([jpeg], `credential-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      const row = await ensureStaffProfile(pb, staffId);
      const fd = new FormData();
      fd.append("photo", photo);
      const updated = await pb.collection("staff_profiles").update(row.id, fd, {
        requestKey: null,
      });
      photoSaved = staffPhotoFilename(
        (updated as { photo?: unknown }).photo
      );
    }

    if (role === "guide") {
      try {
        await ensureGuideProfile(pb, staffId, {
          full_name: name,
          email,
        });
        if (phone) {
          const guide = await ensureGuideProfile(pb, staffId, {
            full_name: name,
            email,
          });
          await pb.collection("guides").update(
            guide.id,
            { phone_number: phone },
            { requestKey: null }
          );
        }
      } catch {
        /* profile optional */
      }
    }
    if (role === "driver") {
      try {
        await ensureDriverProfile(pb, staffId, { full_name: name });
      } catch {
        /* profile optional */
      }
    }

    let emailSent = false;
    let emailError: string | undefined;
    if (sendWelcome) {
      const mailBody = buildContractorWelcomeMail({
        name,
        email,
        role,
        tempPassword,
      });
      const mail = await sendTransactionalMail({
        to: email,
        subject: mailBody.subject,
        text: mailBody.text,
        html: mailBody.html,
        skipTeamBcc: false,
      });
      emailSent = Boolean(mail.sent);
      if (!mail.sent) {
        emailError = mail.reason || "Email is not configured.";
      }
    }

    return NextResponse.json({
      ok: true,
      staffId,
      email,
      role,
      tempPassword,
      forcePasswordChange: true,
      loginUrl: loginUrlForRole(role),
      emailSent,
      ...(emailError ? { emailError } : {}),
      ...(photoSaved ? { photo: photoSaved } : {}),
      ...(vpsPhotoUrl ? { profileUrl: vpsPhotoUrl } : {}),
    });
  } catch (err) {
    console.error("[create-contractor]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Could not create contractor account.",
      },
      { status: 500 }
    );
  }
}
