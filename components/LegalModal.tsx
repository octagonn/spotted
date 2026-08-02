import { BlurView } from "expo-blur";
import { X } from "lucide-react-native";
import { type ReactNode, useEffect, useState } from "react";
import { Modal, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal";
import { colors } from "@/theme/colors";

type LegalTab = "terms" | "privacy";

type LegalModalProps = {
  visible: boolean;
  onClose: () => void;
  initialTab?: LegalTab;
};

function Heading({ children }: { children: ReactNode }) {
  return (
    <Text variant="title" className="mt-8 text-white">
      {children}
    </Text>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return (
    <Text variant="micro" className="mt-6 text-mist">
      {children}
    </Text>
  );
}

function P({ children }: { children: ReactNode }) {
  return (
    <Text variant="body" className="mt-3 text-bone">
      {children}
    </Text>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <View className="mt-2 flex-row gap-3 pl-2">
      <Text variant="body" className="text-mist">
        ·
      </Text>
      <Text variant="body" className="flex-1 text-bone">
        {children}
      </Text>
    </View>
  );
}

export function Terms() {
  return (
    <View>
      <Text variant="display-sm" className="text-white">
        TERMS OF SERVICE
      </Text>
      <Text variant="micro" className="mt-2 text-mist">
        EFFECTIVE {LEGAL_EFFECTIVE_DATE.toUpperCase()}
      </Text>

      <P>
        Welcome to Spotted (the "App"). These Terms of Service ("Terms") form a binding agreement between you
        and Spotted (also "we", "us", or "our") and govern your access to and use of the App, our website, and
        all related services (together, the "Service"). By creating an account, signing in, or otherwise using
        the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
      </P>

      <Heading>1. Eligibility</Heading>
      <P>
        You must be at least 13 years old to use the Service, and at least 16 years old where required by your
        local law (including residents of the European Economic Area and the United Kingdom). By using the
        Service you represent and warrant that you meet these requirements and that you have the legal
        capacity to enter into these Terms. If you are under the age of majority in your jurisdiction, your
        parent or guardian must accept these Terms on your behalf.
      </P>

      <Heading>2. Your Account</Heading>
      <P>
        You can create an account using a verified email address or by signing in with Apple. You are
        responsible for maintaining the confidentiality of your sign-in credentials and for any activity that
        occurs under your account. Notify us immediately at the contact below if you believe your account has
        been accessed without your authorization. We reserve the right to suspend or terminate accounts that
        violate these Terms.
      </P>
      <P>
        Before account creation, you must check the box confirming that you agree to these Terms and the
        Privacy Policy. Your electronic acceptance has the same effect as a written
        signature. We record the versions accepted, the sign-in method, and the acceptance time.
      </P>

      <Heading>3. Your Content</Heading>
      <P>
        The Service lets you capture photos and videos at participating gyms, post captions, message friends,
        and share reactions ("User Content"). You retain ownership of all User Content you create. By
        submitting User Content, you grant Spotted a worldwide, non-exclusive, royalty-free, transferable
        license to host, store, reproduce, modify (for technical purposes such as resizing or compression),
        distribute, perform, and display that content for the limited purpose of operating, improving, and
        promoting the Service.
      </P>
      <P>
        Daily posts and stories are designed to leave the current feed after twenty-four (24) hours.
        Archived posts may remain visible from your profile to authorized viewers until you delete them.
        Even after deletion we may retain backup copies for a limited period or as required by law.
      </P>

      <Heading>4. Acceptable Use</Heading>
      <P>You agree not to use the Service to:</P>
      <Bullet>Post sexually explicit, violent, harassing, hateful, defamatory, or unlawful content.</Bullet>
      <Bullet>Impersonate another person or misrepresent your affiliation with any person or entity.</Bullet>
      <Bullet>Photograph or record any person without their consent where consent is required by law.</Bullet>
      <Bullet>Disclose any individual's home address, phone number, or other personal information without consent.</Bullet>
      <Bullet>Reverse-engineer, decompile, scrape, or otherwise interfere with the Service or its security.</Bullet>
      <Bullet>Use automated systems (bots, crawlers) to access the Service except as expressly permitted.</Bullet>
      <Bullet>Use the Service to violate any applicable law, regulation, or third-party right.</Bullet>
      <P>
        We may, in our sole discretion, remove any content or terminate any account that we believe violates
        these standards.
      </P>

      <Heading>5. Gym Check-ins & Location</Heading>
      <P>
        Spotted verifies posts are made at a participating gym using foreground (while-using) location. You
        choose whether to grant this permission. We do not collect background location and we do not share
        your precise coordinates with other users; we only display whether you are present at a gym, and only
        to the friends you have explicitly added.
      </P>

      <Heading>6. Friends & Visibility</Heading>
      <P>
        You control who can view your posts by managing your friend list. You may block users at any time;
        blocked users will not see your profile, posts, or check-ins. Default visibility for posts and
        check-ins is friends-only. Search results and gym membership lists are visible to other users of the
        Service in accordance with the visibility settings you choose in the App.
      </P>

      <Heading>7. Notifications</Heading>
      <P>
        Push notifications are optional and are not required to use the Service. If enabled, you can choose
        categories, friend check-in scope, daily reminder time, and quiet hours in the App, and you can
        disable permission in your device settings. Delivery timing is not guaranteed. Notification previews
        may appear on a locked device, so use your device's preview controls if you do not want message or
        activity details displayed there. We will obtain separate consent before sending promotional push
        notifications.
      </P>

      <Heading>8. Privacy</Heading>
      <P>
        Our Privacy Policy, accessible from the same screen as these Terms, describes how we collect, use, and
        share information. By using the Service you also agree to that policy.
      </P>

      <Heading>9. Intellectual Property</Heading>
      <P>
        Other than User Content, all materials available through the Service — including the Spotted name, the
        S mark, the user interface, the underlying software, and any documentation — are owned by Spotted or
        our licensors and are protected by intellectual property laws. We grant you a limited, non-exclusive,
        non-transferable, revocable license to use the Service for personal, non-commercial purposes in
        accordance with these Terms.
      </P>

      <Heading>10. Termination</Heading>
      <P>
        You may stop using the Service at any time and may delete your account through the App or by
        contacting us. We may suspend or terminate your access at any time, with or without notice, if we
        believe you have violated these Terms or that continued access poses a risk to other users or to the
        Service. Sections that by their nature should survive termination (such as ownership, disclaimers,
        indemnification, and limits of liability) shall survive.
      </P>

      <Heading>11. Disclaimer of Warranties</Heading>
      <P>
        THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
        IMPLIED, INCLUDING WITHOUT LIMITATION ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
        PURPOSE, NON-INFRINGEMENT, OR ANY IMPLIED WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE.
        WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.
      </P>

      <Heading>12. Limitation of Liability</Heading>
      <P>
        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL SPOTTED, ITS AFFILIATES, OFFICERS,
        EMPLOYEES, AGENTS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
        PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION
        WITH YOUR USE OF (OR INABILITY TO USE) THE SERVICE, WHETHER BASED ON CONTRACT, TORT (INCLUDING
        NEGLIGENCE), STRICT LIABILITY, OR ANY OTHER LEGAL THEORY, EVEN IF WE HAVE BEEN ADVISED OF THE
        POSSIBILITY OF SUCH DAMAGES. OUR TOTAL CUMULATIVE LIABILITY ARISING OUT OF OR RELATED TO THESE TERMS
        OR THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS
        PRECEDING THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS (USD 100).
      </P>

      <Heading>13. Indemnification</Heading>
      <P>
        You agree to indemnify, defend, and hold harmless Spotted and its affiliates, officers, directors,
        employees, and agents from any claims, damages, losses, liabilities, and expenses (including
        reasonable attorneys' fees) arising out of or related to: (i) your User Content; (ii) your use or
        misuse of the Service; (iii) your violation of these Terms; or (iv) your violation of any law or the
        rights of any third party.
      </P>

      <Heading>14. Governing Law & Dispute Resolution</Heading>
      <P>
        These Terms are governed by the laws of the State of California, without regard to conflict-of-laws
        principles. Any dispute arising out of or relating to these Terms or the Service that cannot be
        resolved informally will be resolved through final, binding individual arbitration administered by
        JAMS in Los Angeles County, California, under its Streamlined Arbitration Rules. You and Spotted each
        waive the right to a jury trial and the right to participate in a class action. Notwithstanding the
        foregoing, either party may bring an individual action in small-claims court for disputes within that
        court's jurisdiction, and either party may seek injunctive or equitable relief in court to protect
        intellectual-property rights.
      </P>

      <Heading>15. Changes</Heading>
      <P>
        We may modify these Terms from time to time. If we make material changes, we will provide notice
        within the App or by email. Continued use of the Service after a change becomes effective constitutes
        your acceptance of the updated Terms. If you do not accept the changes, your sole remedy is to stop
        using the Service and delete your account.
      </P>

      <Heading>16. Apple-Specific Terms</Heading>
      <P>
        These Terms are between you and Spotted, not Apple. Apple has no obligation to provide maintenance or
        support for the App. In the event of any failure of the App to conform to any applicable warranty,
        you may notify Apple, and Apple will refund the purchase price of the App (if any) to you. Apple is a
        third-party beneficiary of these Terms and has the right to enforce them against you.
      </P>

      <Heading>17. Contact</Heading>
      <P>
        Questions about these Terms? Email <Text className="text-white">support@spotted.app</Text>.
      </P>
    </View>
  );
}

export function Privacy() {
  return (
    <View>
      <Text variant="display-sm" className="text-white">
        PRIVACY POLICY
      </Text>
      <Text variant="micro" className="mt-2 text-mist">
        EFFECTIVE {LEGAL_EFFECTIVE_DATE.toUpperCase()}
      </Text>

      <P>
        This Privacy Policy explains how Spotted collects, uses, shares, and protects your information when
        you use the App and related services (the "Service"). It applies to information that identifies or
        can reasonably be linked to you ("Personal Information"). If you do not agree with this Policy,
        please do not use the Service.
      </P>

      <Heading>1. Information We Collect</Heading>

      <SubHeading>YOU PROVIDE</SubHeading>
      <Bullet>Account info: email address, or — if you sign in with Apple — your Apple-issued user identifier and the email and name fields you choose to share.</Bullet>
      <Bullet>Profile info: username, display name, optional avatar photo, optional bio, home gym, and weekly schedule.</Bullet>
      <Bullet>User Content: photos, captions, reactions, replies, and direct messages you create through the App.</Bullet>
      <Bullet>Friend graph: the friends you add or remove and the requests you send or receive.</Bullet>
      <Bullet>Legal acceptance: the Terms and Privacy Policy versions you accept, the sign-in method, and the acceptance time.</Bullet>
      <Bullet>Communications: messages you send to support and any other voluntary feedback.</Bullet>

      <SubHeading>COLLECTED AUTOMATICALLY</SubHeading>
      <Bullet>Device, network, and app logs needed to operate and secure the Service, such as app version, OS version, IP address, request time, and error details.</Bullet>
      <Bullet>Location: foreground (while-using) location, used only to verify check-ins at participating gyms. We do not collect background location.</Bullet>
      <Bullet>Notifications: an Expo Push Token linked to your account and app installation, device platform, permission and category settings, delivery ticket or receipt status, errors, and the time you open a notification.</Bullet>
      <Bullet>Local storage: small amounts of data (sessions, preferences, cached lists) stored on-device via AsyncStorage and MMKV.</Bullet>

      <SubHeading>OPTIONAL PRODUCT ANALYTICS</SubHeading>
      <Bullet>If you explicitly opt in, we collect account-linked app opens, screen categories viewed, selected feature actions, and device platform.</Bullet>
      <Bullet>Optional analytics does not contain photos, messages, contacts, precise location, advertising identifiers, usernames, or free-form text.</Bullet>
      <Bullet>Product analytics is off by default and can be changed at any time under Settings → Privacy.</Bullet>

      <SubHeading>FROM THIRD PARTIES</SubHeading>
      <Bullet>Sign-in providers: if you sign in with Apple, Apple provides the identifiers and tokens needed to authenticate you.</Bullet>
      <Bullet>OpenStreetMap contributors: gym names, addresses, and coordinates used to populate the gym directory. No Personal Information is sent to OpenStreetMap.</Bullet>

      <Heading>2. How We Use Information</Heading>
      <Bullet>To provide, operate, and maintain the Service.</Bullet>
      <Bullet>To verify gym check-ins and protect against location spoofing.</Bullet>
      <Bullet>To deliver push notifications you have opted into.</Bullet>
      <Bullet>To record and demonstrate your acceptance of our current legal terms.</Bullet>
      <Bullet>To suggest friends and gyms and personalize your feed.</Bullet>
      <Bullet>To enforce these Terms, prevent abuse, and protect the safety of users and the Service.</Bullet>
      <Bullet>With your consent, to analyze product usage and improve features, performance, and reliability.</Bullet>
      <Bullet>To respond to your support requests and communicate with you about the Service.</Bullet>
      <Bullet>To comply with legal obligations and to enforce or defend our legal rights.</Bullet>

      <Heading>3. Legal Bases (EEA / UK)</Heading>
      <P>
        If you are located in the European Economic Area or the United Kingdom, we process your information
        on the following legal bases: performance of our contract with you (delivering the Service);
        legitimate interests (security, fraud prevention, product improvement); consent (push notifications,
        location, and any optional features that ask for it); and compliance with legal obligations.
      </P>

      <Heading>4. How We Share Information</Heading>
      <P>
        We do not sell Personal Information or share Personal Information for cross-context behavioral
        advertising. We do not sell or share optional product analytics. We disclose information only as
        described below:
      </P>
      <Bullet>
        With service providers who process data on our behalf: Supabase (database, authentication, storage,
        edge functions), Expo / EAS (builds, over-the-air updates, and Expo Push Service), Apple (App Store,
        Sign in with Apple, and APNs), Google (FCM on Android), and our SMTP provider (transactional email
        delivery). These providers process data under their own terms and privacy commitments.
      </Bullet>
      <Bullet>With other users, only the information you choose to share — your profile, posts, and check-ins, in line with your visibility settings.</Bullet>
      <Bullet>For legal reasons: when we believe disclosure is required to comply with law, lawful requests, or legal process; to enforce our Terms; or to protect rights, property, or safety.</Bullet>
      <Bullet>In a corporate transaction such as a merger, acquisition, or asset sale, subject to standard confidentiality protections.</Bullet>
      <Bullet>With your consent, in any other case where we ask for and receive your permission.</Bullet>

      <Heading>5. Photos & Camera</Heading>
      <P>
        Photos you take through the App are uploaded to a private storage bucket controlled by your account.
        They are accessible only via short-lived signed URLs to friends you have authorized to view a
        specific post. We access a photo from your camera roll only when you explicitly select it. When you
        tap Save after taking or editing a photo, we request permission to add that specific photo to your
        library; saving does not give Spotted permission to upload other library photos.
      </P>

      <Heading>6. Location</Heading>
      <P>
        Location is requested only while you are actively using the App. We never collect location in the
        background. Coordinates are used at the moment of check-in to verify proximity to a gym you select;
        we store the gym you checked into, not your precise position. We do not share your latitude and
        longitude with other users.
      </P>

      <Heading>7. Notifications</Heading>
      <P>
        If you allow notifications, Supabase sends an Expo Push Token and notification content to the Expo
        Push Service, which routes it through Apple APNs or Google FCM to your device. Notifications can cover
        messages, friend requests and activity, post views and reactions, tags, communities, achievements,
        check-ins, streaks, and reminders. You can disable all push, individual categories, friend check-in
        scope, quiet hours, or notification permission at any time in the App or device settings. The
        in-app activity inbox may still show social activity when push is disabled. Invalid tokens are
        removed, and signing out unregisters the current installation on a best-effort basis.
      </P>

      <Heading>8. Retention</Heading>
      <P>
        Daily posts and stories leave the current feed after 24 hours; archived posts remain until you delete
        them. Direct messages remain in a conversation according to our messaging controls. In-app
        notifications and linked push-delivery rows are deleted after 7 days; notification deduplication
        logs are deleted after 90 days. Push tokens remain until sign-out, reassignment, invalidation, or
        account deletion. Optional raw product-analytics events are deleted after 90 days, and turning
        product analytics off deletes your retained raw events. Legal acceptance and other account-level
        data remain with your account. An account deletion request hides the account immediately and
        schedules permanent deletion after 30 days; signing back in during that period restores it. Some
        messages already delivered to another user's thread may remain without being linked to your deleted
        account. Backups and security logs may persist for a limited period after deletion when needed for
        security, legal, or operational obligations.
      </P>

      <Heading>9. Your Choices & Rights</Heading>
      <Bullet>Access and correction: review or update your profile information at any time in the App.</Bullet>
      <Bullet>Deletion: delete individual posts in the App, or start full account deletion under Settings → Danger Zone.</Bullet>
      <Bullet>Permissions: revoke camera, microphone, photo library, location, notifications, and contacts permissions in your device settings at any time.</Bullet>
      <Bullet>Product analytics: optional and off by default. Enable or withdraw consent under Settings → Privacy.</Bullet>
      <Bullet>Marketing: we do not run marketing-email campaigns by default; transactional emails (sign-in codes, account alerts) cannot be turned off without disabling sign-in.</Bullet>
      <Bullet>California (CCPA/CPRA): you have rights to know, delete, correct, limit use of sensitive info, opt out of sale or sharing, and not be discriminated against for exercising rights. We currently do not sell or share Personal Information. Email us to make a verifiable request.</Bullet>
      <Bullet>EEA / UK (GDPR): you have rights to access, rectify, erase, restrict, port, or object to processing of your information, and to lodge a complaint with your local supervisory authority.</Bullet>

      <Heading>10. Children's Privacy</Heading>
      <P>
        The Service is not directed to children under 13, and we do not knowingly collect Personal
        Information from anyone under 13. If you believe a child under 13 has provided us with information,
        please contact us so we can remove it.
      </P>

      <Heading>11. International Transfers</Heading>
      <P>
        Spotted operates from the United States and processes data on US-based infrastructure. If you access
        the Service from outside the US, your information may be transferred to and processed in countries
        with different data-protection laws than your home jurisdiction.
      </P>

      <Heading>12. Security</Heading>
      <P>
        We use technical and organizational safeguards designed to protect your information, including
        encryption in transit, encryption of stored credentials, row-level security on database tables,
        signed URLs for private media, and access controls for our team. No system is perfectly secure; we
        cannot guarantee absolute security.
      </P>

      <Heading>13. Changes</Heading>
      <P>
        We may update this Policy. If we make material changes, we will notify you in the App or by email
        before the changes take effect. The "Effective" date at the top tells you when the current version
        was published.
      </P>

      <Heading>14. Contact</Heading>
      <P>
        Questions, requests, or complaints? Email{" "}
        <Text className="text-white">privacy@spotted.app</Text>. We respond within thirty (30) days, sooner
        where required by law.
      </P>
    </View>
  );
}

export function LegalModal({ visible, onClose, initialTab = "terms" }: LegalModalProps) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<LegalTab>(initialTab);
  const useBlur = Platform.OS === "ios";

  useEffect(() => {
    if (visible) setTab(initialTab);
  }, [visible, initialTab]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black">
        {useBlur ? (
          <BlurView intensity={32} tint="dark" className="absolute inset-0" />
        ) : (
          <View className="absolute inset-0 bg-graphite/40" />
        )}

        <View
          className="flex-row items-center justify-between px-5 pb-3"
          style={{ paddingTop: insets.top + 8 }}
        >
          <View className="flex-row gap-2 rounded-pill border border-hairline-strong bg-glass-soft p-1">
            {(["terms", "privacy"] as const).map((value) => {
              const active = tab === value;
              return (
                <Pressable
                  key={value}
                  className={`rounded-pill px-4 py-2 ${active ? "bg-white" : ""}`}
                  onPress={() => setTab(value)}
                >
                  <Text variant="micro" className={active ? "text-black" : "text-mist"}>
                    {value === "terms" ? "TERMS" : "PRIVACY"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full border border-hairline-strong bg-glass-soft"
            onPress={onClose}
            accessibilityLabel="Close"
          >
            <X color={colors.mist} size={18} strokeWidth={1.8} />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: insets.bottom + 48
          }}
          showsVerticalScrollIndicator={false}
        >
          {tab === "terms" ? <Terms /> : <Privacy />}
        </ScrollView>
      </View>
    </Modal>
  );
}
