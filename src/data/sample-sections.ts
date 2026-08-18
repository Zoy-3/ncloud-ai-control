import type { Section } from "@/types/section";

export const sampleSections = [
  {
    id: "section-corporate-about-01",
    name: "Corporate About 01",
    slug: "corporate-about-01",
    category: "corporate",
    sectionType: "about",
    style: "professional",
    layout: "image-left",
    description:
      "Professional two-column corporate About layout with an image area on the left and company introduction on the right.",
    tags: [
      "corporate",
      "business",
      "professional",
      "company",
      "about",
      "two-column",
    ],
    previewImage: "/sample-sections/corporate-about-01.svg",
    shortcode: `[section padding="80px 0px 80px 0px" class="ncloud-corporate-about"]

[row v_align="middle"]

[col span="6" span__sm="12"]

[ux_image]

[/col]

[col span="6" span__sm="12"]

[ux_text]

<p class="section-label">ABOUT OUR COMPANY</p>

<h2>Building Better Solutions for Modern Businesses</h2>

<p>
We help businesses grow through reliable services, smart solutions and a strong commitment to quality.
</p>

<p>
Our experienced team works closely with every client to understand their goals and deliver solutions designed for long-term success.
</p>

[/ux_text]

[button text="Learn More About Us" link="/about/" color="primary"]

[/col]

[/row]

[/section]`,
    status: "published",
  },
  {
    id: "section-tourism-about-01",
    name: "Tourism About 01",
    slug: "tourism-about-01",
    category: "tourism",
    sectionType: "about",
    style: "destination",
    layout: "content-left-image-right",
    description:
      "Travel-focused About layout with editorial content on the left and a large destination image area on the right.",
    tags: ["tourism", "travel", "destination", "tour", "sri-lanka", "about"],
    previewImage: "/sample-sections/tourism-about-01.svg",
    shortcode: `[section padding="90px 0px 90px 0px" class="ncloud-tourism-about"]

[row v_align="middle"]

[col span="6" span__sm="12"]

[ux_text]

<p class="section-label">DISCOVER WITH US</p>

<h2>Experience the Beauty, Culture and Adventure of Sri Lanka</h2>

<p>
We create memorable journeys that connect travellers with beautiful destinations, authentic local experiences and the unique culture of Sri Lanka.
</p>

<p>
From relaxing coastal escapes to wildlife adventures and cultural discoveries, every journey is carefully planned around our guests.
</p>

[/ux_text]

[button text="Discover Our Story" link="/about/" color="primary"]

[/col]

[col span="6" span__sm="12"]

[ux_image]

[/col]

[/row]

[/section]`,
    status: "published",
  },
  {
    id: "section-hotel-about-01",
    name: "Hotel About 01",
    slug: "hotel-about-01",
    category: "hotel",
    sectionType: "about",
    style: "luxury",
    layout: "image-left",
    description:
      "Premium hospitality About layout with property image area, introductory content and room CTA.",
    tags: ["hotel", "resort", "villa", "luxury", "hospitality", "about"],
    previewImage: "/sample-sections/hotel-about-01.svg",
    shortcode: `[section padding="90px 0px 90px 0px" class="ncloud-hotel-about"]

[row v_align="middle"]

[col span="6" span__sm="12"]

[ux_image]

[/col]

[col span="6" span__sm="12"]

[ux_text]

<p class="section-label">WELCOME TO OUR RETREAT</p>

<h2>A Peaceful Stay Designed Around Comfort and Experience</h2>

<p>
Our property combines relaxing surroundings, warm hospitality and thoughtfully designed accommodation to create a memorable stay.
</p>

<p>
Whether you are visiting for a quiet escape, an adventure or a special occasion, our team is here to make every moment feel effortless.
</p>

[/ux_text]

[button text="Explore Our Rooms" link="/rooms/" color="primary"]

[/col]

[/row]

[/section]`,
    status: "published",
  },
  {
    id: "section-ecommerce-about-01",
    name: "Ecommerce About 01",
    slug: "ecommerce-about-01",
    category: "ecommerce",
    sectionType: "about",
    style: "modern-brand",
    layout: "content-left-image-right",
    description:
      "Modern product-brand About layout for WooCommerce and online stores.",
    tags: ["ecommerce", "shop", "woocommerce", "brand", "products", "about"],
    previewImage: "/sample-sections/ecommerce-about-01.svg",
    shortcode: `[section padding="80px 0px 80px 0px" class="ncloud-ecommerce-about"]

[row v_align="middle"]

[col span="6" span__sm="12"]

[ux_text]

<p class="section-label">OUR BRAND</p>

<h2>Products Selected with Quality, Value and Everyday Life in Mind</h2>

<p>
We believe online shopping should be simple, reliable and enjoyable. Our collection is carefully selected to offer customers products they can trust.
</p>

<p>
From product quality to customer support and delivery, we focus on creating a better shopping experience from beginning to end.
</p>

[/ux_text]

[button text="Shop Our Collection" link="/shop/" color="primary"]

[/col]

[col span="6" span__sm="12"]

[ux_image]

[/col]

[/row]

[/section]`,
    status: "published",
  },
] satisfies Section[];
