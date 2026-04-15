export interface Upazila {
  id: string;
  name: string;
  bn_name: string;
  lat: number;
  lng: number;
}

export interface District {
  id: string;
  name: string;
  bn_name: string;
  lat: number;
  lng: number;
  upazilas: Upazila[];
}

export const geoData: District[] = [
  {
    "id": "28",
    "name": "Bagerhat",
    "bn_name": "বাগেরহাট",
    "lat": 22.651568,
    "lng": 89.785938,
    "upazilas": [
      {
        "id": "216",
        "name": "Bagerhat Sadar",
        "bn_name": "বাগেরহাট সদর",
        "lat": 22.651568,
        "lng": 89.785938
      },
      {
        "id": "223",
        "name": "Chitalmari",
        "bn_name": "চিতলমারী",
        "lat": 22.651568,
        "lng": 89.785938
      },
      {
        "id": "215",
        "name": "Fakirhat",
        "bn_name": "ফকিরহাট",
        "lat": 22.651568,
        "lng": 89.785938
      },
      {
        "id": "221",
        "name": "Kachua",
        "bn_name": "কচুয়া",
        "lat": 22.651568,
        "lng": 89.785938
      },
      {
        "id": "217",
        "name": "Mollahat",
        "bn_name": "মোল্লাহাট",
        "lat": 22.651568,
        "lng": 89.785938
      },
      {
        "id": "222",
        "name": "Mongla",
        "bn_name": "মোংলা",
        "lat": 22.651568,
        "lng": 89.785938
      },
      {
        "id": "220",
        "name": "Morrelganj",
        "bn_name": "মোড়েলগঞ্জ",
        "lat": 22.651568,
        "lng": 89.785938
      },
      {
        "id": "219",
        "name": "Rampal",
        "bn_name": "রামপাল",
        "lat": 22.651568,
        "lng": 89.785938
      },
      {
        "id": "218",
        "name": "Sarankhola",
        "bn_name": "শরণখোলা",
        "lat": 22.651568,
        "lng": 89.785938
      }
    ]
  },
  {
    "id": "11",
    "name": "Bandarban",
    "bn_name": "বান্দরবান",
    "lat": 22.1953275,
    "lng": 92.2183773,
    "upazilas": [
      {
        "id": "98",
        "name": "Alikadam",
        "bn_name": "আলীকদম",
        "lat": 22.1953275,
        "lng": 92.2183773
      },
      {
        "id": "97",
        "name": "Bandarban Sadar",
        "bn_name": "বান্দরবান সদর",
        "lat": 22.1953275,
        "lng": 92.2183773
      },
      {
        "id": "101",
        "name": "Lama",
        "bn_name": "লামা",
        "lat": 22.1953275,
        "lng": 92.2183773
      },
      {
        "id": "99",
        "name": "Naikhongchhari",
        "bn_name": "নাইক্ষ্যংছড়ি",
        "lat": 22.1953275,
        "lng": 92.2183773
      },
      {
        "id": "100",
        "name": "Rowangchhari",
        "bn_name": "রোয়াংছড়ি",
        "lat": 22.1953275,
        "lng": 92.2183773
      },
      {
        "id": "102",
        "name": "Ruma",
        "bn_name": "রুমা",
        "lat": 22.1953275,
        "lng": 92.2183773
      },
      {
        "id": "103",
        "name": "Thanchi",
        "bn_name": "থানচি",
        "lat": 22.1953275,
        "lng": 92.2183773
      }
    ]
  },
  {
    "id": "35",
    "name": "Barguna",
    "bn_name": "বরগুনা",
    "lat": 22.159182,
    "lng": 90.125581,
    "upazilas": [
      {
        "id": "266",
        "name": "Amtali",
        "bn_name": "আমতলী",
        "lat": 22.159182,
        "lng": 90.125581
      },
      {
        "id": "269",
        "name": "Bamna",
        "bn_name": "বামনা",
        "lat": 22.159182,
        "lng": 90.125581
      },
      {
        "id": "267",
        "name": "Barguna Sadar",
        "bn_name": "বরগুনা সদর",
        "lat": 22.159182,
        "lng": 90.125581
      },
      {
        "id": "268",
        "name": "Betagi",
        "bn_name": "বেতাগী",
        "lat": 22.159182,
        "lng": 90.125581
      },
      {
        "id": "270",
        "name": "Pathorghata",
        "bn_name": "পাথরঘাটা",
        "lat": 22.159182,
        "lng": 90.125581
      },
      {
        "id": "271",
        "name": "Taltali",
        "bn_name": "তালতলি",
        "lat": 22.159182,
        "lng": 90.125581
      }
    ]
  },
  {
    "id": "33",
    "name": "Barisal",
    "bn_name": "বরিশাল",
    "lat": 22.7004179,
    "lng": 90.3731568,
    "upazilas": [
      {
        "id": "255",
        "name": "Agailjhara",
        "bn_name": "আগৈলঝাড়া",
        "lat": 22.7004179,
        "lng": 90.3731568
      },
      {
        "id": "251",
        "name": "Babuganj",
        "bn_name": "বাবুগঞ্জ",
        "lat": 22.7004179,
        "lng": 90.3731568
      },
      {
        "id": "250",
        "name": "Bakerganj",
        "bn_name": "বাকেরগঞ্জ",
        "lat": 22.7004179,
        "lng": 90.3731568
      },
      {
        "id": "253",
        "name": "Banaripara",
        "bn_name": "বানারীপাড়া",
        "lat": 22.7004179,
        "lng": 90.3731568
      },
      {
        "id": "249",
        "name": "Barisal Sadar",
        "bn_name": "বরিশাল সদর",
        "lat": 22.7004179,
        "lng": 90.3731568
      },
      {
        "id": "254",
        "name": "Gournadi",
        "bn_name": "গৌরনদী",
        "lat": 22.7004179,
        "lng": 90.3731568
      },
      {
        "id": "258",
        "name": "Hizla",
        "bn_name": "হিজলা",
        "lat": 22.7004179,
        "lng": 90.3731568
      },
      {
        "id": "256",
        "name": "Mehendiganj",
        "bn_name": "মেহেন্দিগঞ্জ",
        "lat": 22.7004179,
        "lng": 90.3731568
      },
      {
        "id": "257",
        "name": "Muladi",
        "bn_name": "মুলাদী",
        "lat": 22.7004179,
        "lng": 90.3731568
      },
      {
        "id": "252",
        "name": "Wazirpur",
        "bn_name": "উজিরপুর",
        "lat": 22.7004179,
        "lng": 90.3731568
      }
    ]
  },
  {
    "id": "34",
    "name": "Bhola",
    "bn_name": "ভোলা",
    "lat": 22.685923,
    "lng": 90.648179,
    "upazilas": [
      {
        "id": "259",
        "name": "Bhola Sadar",
        "bn_name": "ভোলা সদর",
        "lat": 22.685923,
        "lng": 90.648179
      },
      {
        "id": "260",
        "name": "Borhan Sddin",
        "bn_name": "বোরহান উদ্দিন",
        "lat": 22.685923,
        "lng": 90.648179
      },
      {
        "id": "261",
        "name": "Charfesson",
        "bn_name": "চরফ্যাশন",
        "lat": 22.685923,
        "lng": 90.648179
      },
      {
        "id": "262",
        "name": "Doulatkhan",
        "bn_name": "দৌলতখান",
        "lat": 22.685923,
        "lng": 90.648179
      },
      {
        "id": "265",
        "name": "Lalmohan",
        "bn_name": "লালমোহন",
        "lat": 22.685923,
        "lng": 90.648179
      },
      {
        "id": "263",
        "name": "Monpura",
        "bn_name": "মনপুরা",
        "lat": 22.685923,
        "lng": 90.648179
      },
      {
        "id": "264",
        "name": "Tazumuddin",
        "bn_name": "তজুমদ্দিন",
        "lat": 22.685923,
        "lng": 90.648179
      }
    ]
  },
  {
    "id": "14",
    "name": "Bogura",
    "bn_name": "বগুড়া",
    "lat": 24.8465228,
    "lng": 89.377755,
    "upazilas": [
      {
        "id": "127",
        "name": "Adamdighi",
        "bn_name": "আদমদিঘি",
        "lat": 24.8465228,
        "lng": 89.377755
      },
      {
        "id": "123",
        "name": "Bogra Sadar",
        "bn_name": "বগুড়া সদর",
        "lat": 24.8465228,
        "lng": 89.377755
      },
      {
        "id": "130",
        "name": "Dhunot",
        "bn_name": "ধুনট",
        "lat": 24.8465228,
        "lng": 89.377755
      },
      {
        "id": "126",
        "name": "Dupchanchia",
        "bn_name": "দুপচাচিঁয়া",
        "lat": 24.8465228,
        "lng": 89.377755
      },
      {
        "id": "131",
        "name": "Gabtali",
        "bn_name": "গাবতলী",
        "lat": 24.8465228,
        "lng": 89.377755
      },
      {
        "id": "122",
        "name": "Kahaloo",
        "bn_name": "কাহালু",
        "lat": 24.8465228,
        "lng": 89.377755
      },
      {
        "id": "128",
        "name": "Nondigram",
        "bn_name": "নন্দিগ্রাম",
        "lat": 24.8465228,
        "lng": 89.377755
      },
      {
        "id": "125",
        "name": "Shajahanpur",
        "bn_name": "শাজাহানপুর",
        "lat": 24.8465228,
        "lng": 89.377755
      },
      {
        "id": "124",
        "name": "Shariakandi",
        "bn_name": "সারিয়াকান্দি",
        "lat": 24.8465228,
        "lng": 89.377755
      },
      {
        "id": "132",
        "name": "Sherpur",
        "bn_name": "শেরপুর",
        "lat": 24.8465228,
        "lng": 89.377755
      },
      {
        "id": "133",
        "name": "Shibganj",
        "bn_name": "শিবগঞ্জ",
        "lat": 24.8465228,
        "lng": 89.377755
      },
      {
        "id": "129",
        "name": "Sonatala",
        "bn_name": "সোনাতলা",
        "lat": 24.8465228,
        "lng": 89.377755
      }
    ]
  },
  {
    "id": "3",
    "name": "Brahmanbaria",
    "bn_name": "ব্রাহ্মণবাড়িয়া",
    "lat": 23.9570904,
    "lng": 91.1119286,
    "upazilas": [
      {
        "id": "29",
        "name": "Akhaura",
        "bn_name": "আখাউড়া",
        "lat": 23.9570904,
        "lng": 91.1119286
      },
      {
        "id": "28",
        "name": "Ashuganj",
        "bn_name": "আশুগঞ্জ",
        "lat": 23.9570904,
        "lng": 91.1119286
      },
      {
        "id": "31",
        "name": "Bancharampur",
        "bn_name": "বাঞ্ছারামপুর",
        "lat": 23.9570904,
        "lng": 91.1119286
      },
      {
        "id": "32",
        "name": "Bijoynagar",
        "bn_name": "বিজয়নগর",
        "lat": 23.9570904,
        "lng": 91.1119286
      },
      {
        "id": "24",
        "name": "Brahmanbaria Sadar",
        "bn_name": "ব্রাহ্মণবাড়িয়া সদর",
        "lat": 23.9570904,
        "lng": 91.1119286
      },
      {
        "id": "25",
        "name": "Kasba",
        "bn_name": "কসবা",
        "lat": 23.9570904,
        "lng": 91.1119286
      },
      {
        "id": "30",
        "name": "Nabinagar",
        "bn_name": "নবীনগর",
        "lat": 23.9570904,
        "lng": 91.1119286
      },
      {
        "id": "26",
        "name": "Nasirnagar",
        "bn_name": "নাসিরনগর",
        "lat": 23.9570904,
        "lng": 91.1119286
      },
      {
        "id": "27",
        "name": "Sarail",
        "bn_name": "সরাইল",
        "lat": 23.9570904,
        "lng": 91.1119286
      }
    ]
  },
  {
    "id": "6",
    "name": "Chandpur",
    "bn_name": "চাঁদপুর",
    "lat": 23.2332585,
    "lng": 90.6712912,
    "upazilas": [
      {
        "id": "55",
        "name": "Chandpur Sadar",
        "bn_name": "চাঁদপুর সদর",
        "lat": 23.2332585,
        "lng": 90.6712912
      },
      {
        "id": "59",
        "name": "Faridgonj",
        "bn_name": "ফরিদগঞ্জ",
        "lat": 23.2332585,
        "lng": 90.6712912
      },
      {
        "id": "52",
        "name": "Haimchar",
        "bn_name": "হাইমচর",
        "lat": 23.2332585,
        "lng": 90.6712912
      },
      {
        "id": "57",
        "name": "Hajiganj",
        "bn_name": "হাজীগঞ্জ",
        "lat": 23.2332585,
        "lng": 90.6712912
      },
      {
        "id": "53",
        "name": "Kachua",
        "bn_name": "কচুয়া",
        "lat": 23.2332585,
        "lng": 90.6712912
      },
      {
        "id": "58",
        "name": "Matlab North",
        "bn_name": "মতলব উত্তর",
        "lat": 23.2332585,
        "lng": 90.6712912
      },
      {
        "id": "56",
        "name": "Matlab South",
        "bn_name": "মতলব দক্ষিণ",
        "lat": 23.2332585,
        "lng": 90.6712912
      },
      {
        "id": "54",
        "name": "Shahrasti",
        "bn_name": "শাহরাস্তি\t",
        "lat": 23.2332585,
        "lng": 90.6712912
      }
    ]
  },
  {
    "id": "18",
    "name": "Chapainawabganj",
    "bn_name": "চাঁপাইনবাবগঞ্জ",
    "lat": 24.5965034,
    "lng": 88.2775122,
    "upazilas": [
      {
        "id": "158",
        "name": "Bholahat",
        "bn_name": "ভোলাহাট",
        "lat": 24.5965034,
        "lng": 88.2775122
      },
      {
        "id": "155",
        "name": "Chapainawabganj Sadar",
        "bn_name": "চাঁপাইনবাবগঞ্জ সদর",
        "lat": 24.5965034,
        "lng": 88.2775122
      },
      {
        "id": "156",
        "name": "Gomostapur",
        "bn_name": "গোমস্তাপুর",
        "lat": 24.5965034,
        "lng": 88.2775122
      },
      {
        "id": "157",
        "name": "Nachol",
        "bn_name": "নাচোল",
        "lat": 24.5965034,
        "lng": 88.2775122
      },
      {
        "id": "159",
        "name": "Shibganj",
        "bn_name": "শিবগঞ্জ",
        "lat": 24.5965034,
        "lng": 88.2775122
      }
    ]
  },
  {
    "id": "8",
    "name": "Chattogram",
    "bn_name": "চট্টগ্রাম",
    "lat": 22.335109,
    "lng": 91.834073,
    "upazilas": [
      {
        "id": "72",
        "name": "Anwara",
        "bn_name": "আনোয়ারা",
        "lat": 22.335109,
        "lng": 91.834073
      },
      {
        "id": "70",
        "name": "Banshkhali",
        "bn_name": "বাঁশখালী",
        "lat": 22.335109,
        "lng": 91.834073
      },
      {
        "id": "71",
        "name": "Boalkhali",
        "bn_name": "বোয়ালখালী",
        "lat": 22.335109,
        "lng": 91.834073
      },
      {
        "id": "73",
        "name": "Chandanaish",
        "bn_name": "চন্দনাইশ",
        "lat": 22.335109,
        "lng": 91.834073
      },
      {
        "id": "77",
        "name": "Fatikchhari",
        "bn_name": "ফটিকছড়ি",
        "lat": 22.335109,
        "lng": 91.834073
      },
      {
        "id": "76",
        "name": "Hathazari",
        "bn_name": "হাটহাজারী",
        "lat": 22.335109,
        "lng": 91.834073
      },
      {
        "id": "79",
        "name": "Karnafuli",
        "bn_name": "কর্ণফুলী",
        "lat": 22.335109,
        "lng": 91.834073
      },
      {
        "id": "75",
        "name": "Lohagara",
        "bn_name": "লোহাগাড়া",
        "lat": 22.335109,
        "lng": 91.834073
      },
      {
        "id": "67",
        "name": "Mirsharai",
        "bn_name": "মীরসরাই",
        "lat": 22.335109,
        "lng": 91.834073
      },
      {
        "id": "68",
        "name": "Patiya",
        "bn_name": "পটিয়া",
        "lat": 22.335109,
        "lng": 91.834073
      },
      {
        "id": "65",
        "name": "Rangunia",
        "bn_name": "রাঙ্গুনিয়া",
        "lat": 22.335109,
        "lng": 91.834073
      },
      {
        "id": "78",
        "name": "Raozan",
        "bn_name": "রাউজান",
        "lat": 22.335109,
        "lng": 91.834073
      },
      {
        "id": "69",
        "name": "Sandwip",
        "bn_name": "সন্দ্বীপ",
        "lat": 22.335109,
        "lng": 91.834073
      },
      {
        "id": "74",
        "name": "Satkania",
        "bn_name": "সাতকানিয়া",
        "lat": 22.335109,
        "lng": 91.834073
      },
      {
        "id": "66",
        "name": "Sitakunda",
        "bn_name": "সীতাকুন্ড",
        "lat": 22.335109,
        "lng": 91.834073
      }
    ]
  },
  {
    "id": "24",
    "name": "Chuadanga",
    "bn_name": "চুয়াডাঙ্গা",
    "lat": 23.6401961,
    "lng": 88.841841,
    "upazilas": [
      {
        "id": "193",
        "name": "Alamdanga",
        "bn_name": "আলমডাঙ্গা",
        "lat": 23.6401961,
        "lng": 88.841841
      },
      {
        "id": "192",
        "name": "Chuadanga Sadar",
        "bn_name": "চুয়াডাঙ্গা সদর",
        "lat": 23.6401961,
        "lng": 88.841841
      },
      {
        "id": "194",
        "name": "Damurhuda",
        "bn_name": "দামুড়হুদা",
        "lat": 23.6401961,
        "lng": 88.841841
      },
      {
        "id": "195",
        "name": "Jibannagar",
        "bn_name": "জীবননগর",
        "lat": 23.6401961,
        "lng": 88.841841
      }
    ]
  },
  {
    "id": "1",
    "name": "Comilla",
    "bn_name": "কুমিল্লা",
    "lat": 23.4682747,
    "lng": 91.1788135,
    "upazilas": [
      {
        "id": "2",
        "name": "Barura",
        "bn_name": "বরুড়া",
        "lat": 23.4682747,
        "lng": 91.1788135
      },
      {
        "id": "3",
        "name": "Brahmanpara",
        "bn_name": "ব্রাহ্মণপাড়া",
        "lat": 23.4682747,
        "lng": 91.1788135
      },
      {
        "id": "16",
        "name": "Burichang",
        "bn_name": "বুড়িচং",
        "lat": 23.4682747,
        "lng": 91.1788135
      },
      {
        "id": "4",
        "name": "Chandina",
        "bn_name": "চান্দিনা",
        "lat": 23.4682747,
        "lng": 91.1788135
      },
      {
        "id": "5",
        "name": "Chauddagram",
        "bn_name": "চৌদ্দগ্রাম",
        "lat": 23.4682747,
        "lng": 91.1788135
      },
      {
        "id": "11",
        "name": "Comilla Sadar",
        "bn_name": "কুমিল্লা সদর",
        "lat": 23.4682747,
        "lng": 91.1788135
      },
      {
        "id": "6",
        "name": "Daudkandi",
        "bn_name": "দাউদকান্দি",
        "lat": 23.4682747,
        "lng": 91.1788135
      },
      {
        "id": "1",
        "name": "Debidwar",
        "bn_name": "দেবিদ্বার",
        "lat": 23.4682747,
        "lng": 91.1788135
      },
      {
        "id": "7",
        "name": "Homna",
        "bn_name": "হোমনা",
        "lat": 23.4682747,
        "lng": 91.1788135
      },
      {
        "id": "8",
        "name": "Laksam",
        "bn_name": "লাকসাম",
        "lat": 23.4682747,
        "lng": 91.1788135
      },
      {
        "id": "17",
        "name": "Lalmai",
        "bn_name": "লালমাই",
        "lat": 23.4682747,
        "lng": 91.1788135
      },
      {
        "id": "12",
        "name": "Meghna",
        "bn_name": "মেঘনা",
        "lat": 23.4682747,
        "lng": 91.1788135
      },
      {
        "id": "13",
        "name": "Monohargonj",
        "bn_name": "মনোহরগঞ্জ",
        "lat": 23.4682747,
        "lng": 91.1788135
      },
      {
        "id": "9",
        "name": "Muradnagar",
        "bn_name": "মুরাদনগর",
        "lat": 23.4682747,
        "lng": 91.1788135
      },
      {
        "id": "10",
        "name": "Nangalkot",
        "bn_name": "নাঙ্গলকোট",
        "lat": 23.4682747,
        "lng": 91.1788135
      },
      {
        "id": "14",
        "name": "Sadarsouth",
        "bn_name": "সদর দক্ষিণ",
        "lat": 23.4682747,
        "lng": 91.1788135
      },
      {
        "id": "15",
        "name": "Titas",
        "bn_name": "তিতাস",
        "lat": 23.4682747,
        "lng": 91.1788135
      }
    ]
  },
  {
    "id": "9",
    "name": "Coxsbazar",
    "bn_name": "কক্সবাজার",
    "lat": 21.44315751,
    "lng": 91.97381741,
    "upazilas": [
      {
        "id": "81",
        "name": "Chakaria",
        "bn_name": "চকরিয়া",
        "lat": 21.44315751,
        "lng": 91.97381741
      },
      {
        "id": "80",
        "name": "Coxsbazar Sadar",
        "bn_name": "কক্সবাজার সদর",
        "lat": 21.44315751,
        "lng": 91.97381741
      },
      {
        "id": "492",
        "name": "Eidgaon",
        "bn_name": "ঈদগাঁও",
        "lat": 21.44315751,
        "lng": 91.97381741
      },
      {
        "id": "82",
        "name": "Kutubdia",
        "bn_name": "কুতুবদিয়া",
        "lat": 21.44315751,
        "lng": 91.97381741
      },
      {
        "id": "84",
        "name": "Moheshkhali",
        "bn_name": "মহেশখালী",
        "lat": 21.44315751,
        "lng": 91.97381741
      },
      {
        "id": "85",
        "name": "Pekua",
        "bn_name": "পেকুয়া",
        "lat": 21.44315751,
        "lng": 91.97381741
      },
      {
        "id": "86",
        "name": "Ramu",
        "bn_name": "রামু",
        "lat": 21.44315751,
        "lng": 91.97381741
      },
      {
        "id": "87",
        "name": "Teknaf",
        "bn_name": "টেকনাফ",
        "lat": 21.44315751,
        "lng": 91.97381741
      },
      {
        "id": "83",
        "name": "Ukhiya",
        "bn_name": "উখিয়া",
        "lat": 21.44315751,
        "lng": 91.97381741
      }
    ]
  },
  {
    "id": "47",
    "name": "Dhaka",
    "bn_name": "ঢাকা",
    "lat": 23.7115253,
    "lng": 90.4111451,
    "upazilas": [
      {
        "id": "366",
        "name": "Dhamrai",
        "bn_name": "ধামরাই",
        "lat": 23.7115253,
        "lng": 90.4111451
      },
      {
        "id": "369",
        "name": "Dohar",
        "bn_name": "দোহার",
        "lat": 23.7115253,
        "lng": 90.4111451
      },
      {
        "id": "367",
        "name": "Keraniganj",
        "bn_name": "কেরাণীগঞ্জ",
        "lat": 23.7115253,
        "lng": 90.4111451
      },
      {
        "id": "368",
        "name": "Nawabganj",
        "bn_name": "নবাবগঞ্জ",
        "lat": 23.7115253,
        "lng": 90.4111451
      },
      {
        "id": "365",
        "name": "Savar",
        "bn_name": "সাভার",
        "lat": 23.7115253,
        "lng": 90.4111451
      }
    ]
  },
  {
    "id": "54",
    "name": "Dinajpur",
    "bn_name": "দিনা���পুর",
    "lat": 25.6217061,
    "lng": 88.6354504,
    "upazilas": [
      {
        "id": "407",
        "name": "Birampur",
        "bn_name": "বিরামপুর",
        "lat": 25.6217061,
        "lng": 88.6354504
      },
      {
        "id": "405",
        "name": "Birganj",
        "bn_name": "বীরগঞ্জ",
        "lat": 25.6217061,
        "lng": 88.6354504
      },
      {
        "id": "415",
        "name": "Birol",
        "bn_name": "বিরল",
        "lat": 25.6217061,
        "lng": 88.6354504
      },
      {
        "id": "409",
        "name": "Bochaganj",
        "bn_name": "বোচাগঞ্জ",
        "lat": 25.6217061,
        "lng": 88.6354504
      },
      {
        "id": "416",
        "name": "Chirirbandar",
        "bn_name": "চিরিরবন্দর",
        "lat": 25.6217061,
        "lng": 88.6354504
      },
      {
        "id": "412",
        "name": "Dinajpur Sadar",
        "bn_name": "দিনাজপুর সদর",
        "lat": 25.6217061,
        "lng": 88.6354504
      },
      {
        "id": "411",
        "name": "Fulbari",
        "bn_name": "ফুলবাড়ী",
        "lat": 25.6217061,
        "lng": 88.6354504
      },
      {
        "id": "406",
        "name": "Ghoraghat",
        "bn_name": "ঘোড়াঘাট",
        "lat": 25.6217061,
        "lng": 88.6354504
      },
      {
        "id": "413",
        "name": "Hakimpur",
        "bn_name": "হাকিমপুর",
        "lat": 25.6217061,
        "lng": 88.6354504
      },
      {
        "id": "410",
        "name": "Kaharol",
        "bn_name": "কাহারোল",
        "lat": 25.6217061,
        "lng": 88.6354504
      },
      {
        "id": "414",
        "name": "Khansama",
        "bn_name": "খানসামা",
        "lat": 25.6217061,
        "lng": 88.6354504
      },
      {
        "id": "404",
        "name": "Nawabganj",
        "bn_name": "নবাবগঞ্জ",
        "lat": 25.6217061,
        "lng": 88.6354504
      },
      {
        "id": "408",
        "name": "Parbatipur",
        "bn_name": "পার্বতীপুর",
        "lat": 25.6217061,
        "lng": 88.6354504
      }
    ]
  },
  {
    "id": "52",
    "name": "Faridpur",
    "bn_name": "ফরিদপুর",
    "lat": 23.6070822,
    "lng": 89.8429406,
    "upazilas": [
      {
        "id": "391",
        "name": "Alfadanga",
        "bn_name": "আলফাডাঙ্গা",
        "lat": 23.6070822,
        "lng": 89.8429406
      },
      {
        "id": "395",
        "name": "Bhanga",
        "bn_name": "ভাঙ্গা",
        "lat": 23.6070822,
        "lng": 89.8429406
      },
      {
        "id": "392",
        "name": "Boalmari",
        "bn_name": "বোয়ালমারী",
        "lat": 23.6070822,
        "lng": 89.8429406
      },
      {
        "id": "396",
        "name": "Charbhadrasan",
        "bn_name": "চরভদ্রাসন",
        "lat": 23.6070822,
        "lng": 89.8429406
      },
      {
        "id": "390",
        "name": "Faridpur Sadar",
        "bn_name": "ফরিদপুর সদর",
        "lat": 23.6070822,
        "lng": 89.8429406
      },
      {
        "id": "397",
        "name": "Madhukhali",
        "bn_name": "মধুখালী",
        "lat": 23.6070822,
        "lng": 89.8429406
      },
      {
        "id": "394",
        "name": "Nagarkanda",
        "bn_name": "নগরকান্দা",
        "lat": 23.6070822,
        "lng": 89.8429406
      },
      {
        "id": "393",
        "name": "Sadarpur",
        "bn_name": "সদরপুর",
        "lat": 23.6070822,
        "lng": 89.8429406
      },
      {
        "id": "398",
        "name": "Saltha",
        "bn_name": "সালথা",
        "lat": 23.6070822,
        "lng": 89.8429406
      }
    ]
  },
  {
    "id": "2",
    "name": "Feni",
    "bn_name": "ফেনী",
    "lat": 23.023231,
    "lng": 91.3840844,
    "upazilas": [
      {
        "id": "18",
        "name": "Chhagalnaiya",
        "bn_name": "ছাগলনাইয়া",
        "lat": 23.023231,
        "lng": 91.3840844
      },
      {
        "id": "23",
        "name": "Daganbhuiyan",
        "bn_name": "দাগনভূঞা",
        "lat": 23.023231,
        "lng": 91.3840844
      },
      {
        "id": "19",
        "name": "Feni Sadar",
        "bn_name": "ফেনী সদর",
        "lat": 23.023231,
        "lng": 91.3840844
      },
      {
        "id": "21",
        "name": "Fulgazi",
        "bn_name": "ফুলগাজী",
        "lat": 23.023231,
        "lng": 91.3840844
      },
      {
        "id": "22",
        "name": "Parshuram",
        "bn_name": "পরশুরাম",
        "lat": 23.023231,
        "lng": 91.3840844
      },
      {
        "id": "20",
        "name": "Sonagazi",
        "bn_name": "সোনাগাজী",
        "lat": 23.023231,
        "lng": 91.3840844
      }
    ]
  },
  {
    "id": "57",
    "name": "Gaibandha",
    "bn_name": "গাইবান্ধা",
    "lat": 25.328751,
    "lng": 89.528088,
    "upazilas": [
      {
        "id": "429",
        "name": "Gaibandha Sadar",
        "bn_name": "গাইবান্ধা সদর",
        "lat": 25.328751,
        "lng": 89.528088
      },
      {
        "id": "432",
        "name": "Gobindaganj",
        "bn_name": "গোবিন্দগঞ্জ",
        "lat": 25.328751,
        "lng": 89.528088
      },
      {
        "id": "430",
        "name": "Palashbari",
        "bn_name": "পলাশবাড়ী",
        "lat": 25.328751,
        "lng": 89.528088
      },
      {
        "id": "434",
        "name": "Phulchari",
        "bn_name": "ফুলছড়ি",
        "lat": 25.328751,
        "lng": 89.528088
      },
      {
        "id": "428",
        "name": "Sadullapur",
        "bn_name": "সাদুল্লাপুর",
        "lat": 25.328751,
        "lng": 89.528088
      },
      {
        "id": "431",
        "name": "Saghata",
        "bn_name": "সাঘাটা",
        "lat": 25.328751,
        "lng": 89.528088
      },
      {
        "id": "433",
        "name": "Sundarganj",
        "bn_name": "সুন্দরগঞ্জ",
        "lat": 25.328751,
        "lng": 89.528088
      }
    ]
  },
  {
    "id": "41",
    "name": "Gazipur",
    "bn_name": "গাজীপুর",
    "lat": 24.0022858,
    "lng": 90.4264283,
    "upazilas": [
      {
        "id": "320",
        "name": "Gazipur Sadar",
        "bn_name": "গাজীপুর সদর",
        "lat": 24.0022858,
        "lng": 90.4264283
      },
      {
        "id": "318",
        "name": "Kaliakair",
        "bn_name": "কালিয়াকৈর",
        "lat": 24.0022858,
        "lng": 90.4264283
      },
      {
        "id": "317",
        "name": "Kaliganj",
        "bn_name": "কালীগঞ্জ",
        "lat": 24.0022858,
        "lng": 90.4264283
      },
      {
        "id": "319",
        "name": "Kapasia",
        "bn_name": "কাপাসিয়া",
        "lat": 24.0022858,
        "lng": 90.4264283
      },
      {
        "id": "321",
        "name": "Sreepur",
        "bn_name": "শ্রীপুর",
        "lat": 24.0022858,
        "lng": 90.4264283
      }
    ]
  },
  {
    "id": "51",
    "name": "Gopalganj",
    "bn_name": "গোপালগঞ্জ",
    "lat": 23.0050857,
    "lng": 89.8266059,
    "upazilas": [
      {
        "id": "385",
        "name": "Gopalganj Sadar",
        "bn_name": "গোপালগঞ্জ সদর",
        "lat": 23.0050857,
        "lng": 89.8266059
      },
      {
        "id": "386",
        "name": "Kashiani",
        "bn_name": "কাশিয়ানী",
        "lat": 23.0050857,
        "lng": 89.8266059
      },
      {
        "id": "388",
        "name": "Kotalipara",
        "bn_name": "কোটালীপাড়া",
        "lat": 23.0050857,
        "lng": 89.8266059
      },
      {
        "id": "389",
        "name": "Muksudpur",
        "bn_name": "মুকসুদপুর",
        "lat": 23.0050857,
        "lng": 89.8266059
      },
      {
        "id": "387",
        "name": "Tungipara",
        "bn_name": "টুংগীপাড়া",
        "lat": 23.0050857,
        "lng": 89.8266059
      }
    ]
  },
  {
    "id": "38",
    "name": "Habiganj",
    "bn_name": "হবিগঞ্জ",
    "lat": 24.374945,
    "lng": 91.41553,
    "upazilas": [
      {
        "id": "294",
        "name": "Ajmiriganj",
        "bn_name": "আজমিরীগঞ্জ",
        "lat": 24.374945,
        "lng": 91.41553
      },
      {
        "id": "293",
        "name": "Bahubal",
        "bn_name": "বাহুবল",
        "lat": 24.374945,
        "lng": 91.41553
      },
      {
        "id": "295",
        "name": "Baniachong",
        "bn_name": "বানিয়াচং",
        "lat": 24.374945,
        "lng": 91.41553
      },
      {
        "id": "297",
        "name": "Chunarughat",
        "bn_name": "চুনারুঘাট",
        "lat": 24.374945,
        "lng": 91.41553
      },
      {
        "id": "298",
        "name": "Habiganj Sadar",
        "bn_name": "হবিগঞ্জ সদর",
        "lat": 24.374945,
        "lng": 91.41553
      },
      {
        "id": "296",
        "name": "Lakhai",
        "bn_name": "লাখাই",
        "lat": 24.374945,
        "lng": 91.41553
      },
      {
        "id": "299",
        "name": "Madhabpur",
        "bn_name": "মাধবপুর",
        "lat": 24.374945,
        "lng": 91.41553
      },
      {
        "id": "292",
        "name": "Nabiganj",
        "bn_name": "নবীগঞ্জ",
        "lat": 24.374945,
        "lng": 91.41553
      }
    ]
  },
  {
    "id": "63",
    "name": "Jamalpur",
    "bn_name": "জাম��লপুর",
    "lat": 24.937533,
    "lng": 89.937775,
    "upazilas": [
      {
        "id": "481",
        "name": "Bokshiganj",
        "bn_name": "বকশীগঞ্জ",
        "lat": 24.937533,
        "lng": 89.937775
      },
      {
        "id": "478",
        "name": "Dewangonj",
        "bn_name": "দেওয়ানগঞ্জ",
        "lat": 24.937533,
        "lng": 89.937775
      },
      {
        "id": "477",
        "name": "Islampur",
        "bn_name": "ইসলামপুর",
        "lat": 24.937533,
        "lng": 89.937775
      },
      {
        "id": "475",
        "name": "Jamalpur Sadar",
        "bn_name": "জামালপুর সদর",
        "lat": 24.937533,
        "lng": 89.937775
      },
      {
        "id": "480",
        "name": "Madarganj",
        "bn_name": "মাদারগঞ্জ",
        "lat": 24.937533,
        "lng": 89.937775
      },
      {
        "id": "476",
        "name": "Melandah",
        "bn_name": "মেলান্দহ",
        "lat": 24.937533,
        "lng": 89.937775
      },
      {
        "id": "479",
        "name": "Sarishabari",
        "bn_name": "সরিষাবাড়ী",
        "lat": 24.937533,
        "lng": 89.937775
      }
    ]
  },
  {
    "id": "20",
    "name": "Jashore",
    "bn_name": "যশোর",
    "lat": 23.16643,
    "lng": 89.2081126,
    "upazilas": [
      {
        "id": "172",
        "name": "Abhaynagar",
        "bn_name": "অভয়নগর",
        "lat": 23.16643,
        "lng": 89.2081126
      },
      {
        "id": "173",
        "name": "Bagherpara",
        "bn_name": "বাঘারপাড়া",
        "lat": 23.16643,
        "lng": 89.2081126
      },
      {
        "id": "174",
        "name": "Chougachha",
        "bn_name": "চৌগাছা",
        "lat": 23.16643,
        "lng": 89.2081126
      },
      {
        "id": "177",
        "name": "Jessore Sadar",
        "bn_name": "যশোর সদর",
        "lat": 23.16643,
        "lng": 89.2081126
      },
      {
        "id": "175",
        "name": "Jhikargacha",
        "bn_name": "ঝিকরগাছা",
        "lat": 23.16643,
        "lng": 89.2081126
      },
      {
        "id": "176",
        "name": "Keshabpur",
        "bn_name": "কেশবপুর",
        "lat": 23.16643,
        "lng": 89.2081126
      },
      {
        "id": "171",
        "name": "Manirampur",
        "bn_name": "মণিরামপুর",
        "lat": 23.16643,
        "lng": 89.2081126
      },
      {
        "id": "178",
        "name": "Sharsha",
        "bn_name": "শার্শা",
        "lat": 23.16643,
        "lng": 89.2081126
      }
    ]
  },
  {
    "id": "30",
    "name": "Jhalakathi",
    "bn_name": "ঝালকাঠি",
    "lat": 22.6422689,
    "lng": 90.2003932,
    "upazilas": [
      {
        "id": "230",
        "name": "Jhalakathi Sadar",
        "bn_name": "ঝালকাঠি সদর",
        "lat": 22.6422689,
        "lng": 90.2003932
      },
      {
        "id": "231",
        "name": "Kathalia",
        "bn_name": "কাঠালিয়া",
        "lat": 22.6422689,
        "lng": 90.2003932
      },
      {
        "id": "232",
        "name": "Nalchity",
        "bn_name": "নলছিটি",
        "lat": 22.6422689,
        "lng": 90.2003932
      },
      {
        "id": "233",
        "name": "Rajapur",
        "bn_name": "রাজাপুর",
        "lat": 22.6422689,
        "lng": 90.2003932
      }
    ]
  },
  {
    "id": "29",
    "name": "Jhenaidah",
    "bn_name": "ঝিনাইদহ",
    "lat": 23.5448176,
    "lng": 89.1539213,
    "upazilas": [
      {
        "id": "226",
        "name": "Harinakundu",
        "bn_name": "হরিণাকুন্ডু",
        "lat": 23.5448176,
        "lng": 89.1539213
      },
      {
        "id": "224",
        "name": "Jhenaidah Sadar",
        "bn_name": "ঝিনাইদহ সদর",
        "lat": 23.5448176,
        "lng": 89.1539213
      },
      {
        "id": "227",
        "name": "Kaliganj",
        "bn_name": "কালীগঞ্জ",
        "lat": 23.5448176,
        "lng": 89.1539213
      },
      {
        "id": "228",
        "name": "Kotchandpur",
        "bn_name": "কোটচাঁদপুর",
        "lat": 23.5448176,
        "lng": 89.1539213
      },
      {
        "id": "229",
        "name": "Moheshpur",
        "bn_name": "মহেশপুর",
        "lat": 23.5448176,
        "lng": 89.1539213
      },
      {
        "id": "225",
        "name": "Shailkupa",
        "bn_name": "শৈলকুপা",
        "lat": 23.5448176,
        "lng": 89.1539213
      }
    ]
  },
  {
    "id": "17",
    "name": "Joypurhat",
    "bn_name": "জয়পুরহাট",
    "lat": 25.09636876,
    "lng": 89.0400428,
    "upazilas": [
      {
        "id": "150",
        "name": "Akkelpur",
        "bn_name": "আক্কেলপুর",
        "lat": 25.09636876,
        "lng": 89.0400428
      },
      {
        "id": "154",
        "name": "Joypurhat Sadar",
        "bn_name": "জয়পুরহাট সদর",
        "lat": 25.09636876,
        "lng": 89.0400428
      },
      {
        "id": "151",
        "name": "Kalai",
        "bn_name": "কালাই",
        "lat": 25.09636876,
        "lng": 89.0400428
      },
      {
        "id": "152",
        "name": "Khetlal",
        "bn_name": "ক্ষেতলাল",
        "lat": 25.09636876,
        "lng": 89.0400428
      },
      {
        "id": "153",
        "name": "Panchbibi",
        "bn_name": "পাঁচবিবি",
        "lat": 25.09636876,
        "lng": 89.0400428
      }
    ]
  },
  {
    "id": "10",
    "name": "Khagrachhari",
    "bn_name": "খাগড়াছড়ি",
    "lat": 23.119285,
    "lng": 91.984663,
    "upazilas": [
      {
        "id": "89",
        "name": "Dighinala",
        "bn_name": "দিঘীনালা",
        "lat": 23.119285,
        "lng": 91.984663
      },
      {
        "id": "96",
        "name": "Guimara",
        "bn_name": "গুইমারা",
        "lat": 23.119285,
        "lng": 91.984663
      },
      {
        "id": "88",
        "name": "Khagrachhari Sadar",
        "bn_name": "খাগড়াছড়ি সদর",
        "lat": 23.119285,
        "lng": 91.984663
      },
      {
        "id": "91",
        "name": "Laxmichhari",
        "bn_name": "লক্ষীছড়ি",
        "lat": 23.119285,
        "lng": 91.984663
      },
      {
        "id": "93",
        "name": "Manikchari",
        "bn_name": "মানিকছড়ি",
        "lat": 23.119285,
        "lng": 91.984663
      },
      {
        "id": "95",
        "name": "Matiranga",
        "bn_name": "মাটিরাঙ্গা",
        "lat": 23.119285,
        "lng": 91.984663
      },
      {
        "id": "92",
        "name": "Mohalchari",
        "bn_name": "মহালছড়ি",
        "lat": 23.119285,
        "lng": 91.984663
      },
      {
        "id": "90",
        "name": "Panchari",
        "bn_name": "পানছড়ি",
        "lat": 23.119285,
        "lng": 91.984663
      },
      {
        "id": "94",
        "name": "Ramgarh",
        "bn_name": "রামগড়",
        "lat": 23.119285,
        "lng": 91.984663
      }
    ]
  },
  {
    "id": "27",
    "name": "Khulna",
    "bn_name": "খুলনা",
    "lat": 22.815774,
    "lng": 89.568679,
    "upazilas": [
      {
        "id": "212",
        "name": "Botiaghata",
        "bn_name": "বটিয়াঘাটা",
        "lat": 22.815774,
        "lng": 89.568679
      },
      {
        "id": "213",
        "name": "Dakop",
        "bn_name": "দাকোপ",
        "lat": 22.815774,
        "lng": 89.568679
      },
      {
        "id": "208",
        "name": "Digholia",
        "bn_name": "দিঘলিয়া",
        "lat": 22.815774,
        "lng": 89.568679
      },
      {
        "id": "211",
        "name": "Dumuria",
        "bn_name": "ডুমুরিয়া",
        "lat": 22.815774,
        "lng": 89.568679
      },
      {
        "id": "207",
        "name": "Fultola",
        "bn_name": "ফুলতলা",
        "lat": 22.815774,
        "lng": 89.568679
      },
      {
        "id": "214",
        "name": "Koyra",
        "bn_name": "কয়রা",
        "lat": 22.815774,
        "lng": 89.568679
      },
      {
        "id": "206",
        "name": "Paikgasa",
        "bn_name": "পাইকগাছা",
        "lat": 22.815774,
        "lng": 89.568679
      },
      {
        "id": "209",
        "name": "Rupsha",
        "bn_name": "রূপসা",
        "lat": 22.815774,
        "lng": 89.568679
      },
      {
        "id": "210",
        "name": "Terokhada",
        "bn_name": "তেরখাদা",
        "lat": 22.815774,
        "lng": 89.568679
      }
    ]
  },
  {
    "id": "45",
    "name": "Kishoreganj",
    "bn_name": "কিশোরগঞ্জ",
    "lat": 24.444937,
    "lng": 90.776575,
    "upazilas": [
      {
        "id": "355",
        "name": "Austagram",
        "bn_name": "অষ্টগ্রাম",
        "lat": 24.444937,
        "lng": 90.776575
      },
      {
        "id": "354",
        "name": "Bajitpur",
        "bn_name": "বাজিতপুর",
        "lat": 24.444937,
        "lng": 90.776575
      },
      {
        "id": "347",
        "name": "Bhairab",
        "bn_name": "ভৈরব",
        "lat": 24.444937,
        "lng": 90.776575
      },
      {
        "id": "349",
        "name": "Hossainpur",
        "bn_name": "হোসেনপুর",
        "lat": 24.444937,
        "lng": 90.776575
      },
      {
        "id": "345",
        "name": "Itna",
        "bn_name": "ইটনা",
        "lat": 24.444937,
        "lng": 90.776575
      },
      {
        "id": "353",
        "name": "Karimgonj",
        "bn_name": "করিমগঞ্জ",
        "lat": 24.444937,
        "lng": 90.776575
      },
      {
        "id": "346",
        "name": "Katiadi",
        "bn_name": "কটিয়াদী",
        "lat": 24.444937,
        "lng": 90.776575
      },
      {
        "id": "352",
        "name": "Kishoreganj Sadar",
        "bn_name": "কিশোরগঞ্জ সদর",
        "lat": 24.444937,
        "lng": 90.776575
      },
      {
        "id": "351",
        "name": "Kuliarchar",
        "bn_name": "কুলিয়ারচর",
        "lat": 24.444937,
        "lng": 90.776575
      },
      {
        "id": "356",
        "name": "Mithamoin",
        "bn_name": "মিঠামইন",
        "lat": 24.444937,
        "lng": 90.776575
      },
      {
        "id": "357",
        "name": "Nikli",
        "bn_name": "নিকলী",
        "lat": 24.444937,
        "lng": 90.776575
      },
      {
        "id": "350",
        "name": "Pakundia",
        "bn_name": "পাকুন্দিয়া",
        "lat": 24.444937,
        "lng": 90.776575
      },
      {
        "id": "348",
        "name": "Tarail",
        "bn_name": "তাড়াইল",
        "lat": 24.444937,
        "lng": 90.776575
      }
    ]
  },
  {
    "id": "60",
    "name": "Kurigram",
    "bn_name": "কুড়িগ্রাম",
    "lat": 25.805445,
    "lng": 89.636174,
    "upazilas": [
      {
        "id": "450",
        "name": "Bhurungamari",
        "bn_name": "ভুরুঙ্গামারী",
        "lat": 25.805445,
        "lng": 89.636174
      },
      {
        "id": "456",
        "name": "Charrajibpur",
        "bn_name": "চর রাজিবপুর",
        "lat": 25.805445,
        "lng": 89.636174
      },
      {
        "id": "454",
        "name": "Chilmari",
        "bn_name": "চিলমারী",
        "lat": 25.805445,
        "lng": 89.636174
      },
      {
        "id": "448",
        "name": "Kurigram Sadar",
        "bn_name": "কুড়িগ্রাম সদর",
        "lat": 25.805445,
        "lng": 89.636174
      },
      {
        "id": "449",
        "name": "Nageshwari",
        "bn_name": "নাগেশ্বরী",
        "lat": 25.805445,
        "lng": 89.636174
      },
      {
        "id": "451",
        "name": "Phulbari",
        "bn_name": "ফুলবাড়ী",
        "lat": 25.805445,
        "lng": 89.636174
      },
      {
        "id": "452",
        "name": "Rajarhat",
        "bn_name": "রাজারহাট",
        "lat": 25.805445,
        "lng": 89.636174
      },
      {
        "id": "455",
        "name": "Rowmari",
        "bn_name": "রৌমারী",
        "lat": 25.805445,
        "lng": 89.636174
      },
      {
        "id": "453",
        "name": "Ulipur",
        "bn_name": "উলিপুর",
        "lat": 25.805445,
        "lng": 89.636174
      }
    ]
  },
  {
    "id": "25",
    "name": "Kushtia",
    "bn_name": "কুষ্টিয়া",
    "lat": 23.901258,
    "lng": 89.120482,
    "upazilas": [
      {
        "id": "201",
        "name": "Bheramara",
        "bn_name": "ভেড়ামারা",
        "lat": 23.901258,
        "lng": 89.120482
      },
      {
        "id": "200",
        "name": "Daulatpur",
        "bn_name": "দৌলতপুর",
        "lat": 23.901258,
        "lng": 89.120482
      },
      {
        "id": "198",
        "name": "Khoksa",
        "bn_name": "খোকসা",
        "lat": 23.901258,
        "lng": 89.120482
      },
      {
        "id": "197",
        "name": "Kumarkhali",
        "bn_name": "কুমারখালী",
        "lat": 23.901258,
        "lng": 89.120482
      },
      {
        "id": "196",
        "name": "Kushtia Sadar",
        "bn_name": "কুষ্টিয়া সদর",
        "lat": 23.901258,
        "lng": 89.120482
      },
      {
        "id": "199",
        "name": "Mirpur",
        "bn_name": "মিরপুর",
        "lat": 23.901258,
        "lng": 89.120482
      }
    ]
  },
  {
    "id": "7",
    "name": "Lakshmipur",
    "bn_name": "লক্ষ্মীপুর",
    "lat": 22.942477,
    "lng": 90.841184,
    "upazilas": [
      {
        "id": "61",
        "name": "Kamalnagar",
        "bn_name": "কমলনগর",
        "lat": 22.942477,
        "lng": 90.841184
      },
      {
        "id": "60",
        "name": "Lakshmipur Sadar",
        "bn_name": "লক্ষ্মীপুর সদর",
        "lat": 22.942477,
        "lng": 90.841184
      },
      {
        "id": "62",
        "name": "Raipur",
        "bn_name": "রায়পুর",
        "lat": 22.942477,
        "lng": 90.841184
      },
      {
        "id": "64",
        "name": "Ramganj",
        "bn_name": "রামগঞ্জ",
        "lat": 22.942477,
        "lng": 90.841184
      },
      {
        "id": "63",
        "name": "Ramgati",
        "bn_name": "রামগতি",
        "lat": 22.942477,
        "lng": 90.841184
      }
    ]
  },
  {
    "id": "55",
    "name": "Lalmonirhat",
    "bn_name": "লালমনিরহাট",
    "lat": 25.9165451,
    "lng": 89.4532409,
    "upazilas": [
      {
        "id": "421",
        "name": "Aditmari",
        "bn_name": "আদিতমারী",
        "lat": 25.9165451,
        "lng": 89.4532409
      },
      {
        "id": "419",
        "name": "Hatibandha",
        "bn_name": "হাতীবান্ধা",
        "lat": 25.9165451,
        "lng": 89.4532409
      },
      {
        "id": "418",
        "name": "Kaliganj",
        "bn_name": "কালীগঞ্জ",
        "lat": 25.9165451,
        "lng": 89.4532409
      },
      {
        "id": "417",
        "name": "Lalmonirhat Sadar",
        "bn_name": "লালমনিরহাট সদর",
        "lat": 25.9165451,
        "lng": 89.4532409
      },
      {
        "id": "420",
        "name": "Patgram",
        "bn_name": "পাটগ্রাম",
        "lat": 25.9165451,
        "lng": 89.4532409
      }
    ]
  },
  {
    "id": "50",
    "name": "Madaripur",
    "bn_name": "মাদারীপুর",
    "lat": 23.164102,
    "lng": 90.1896805,
    "upazilas": [
      {
        "id": "494",
        "name": "Dasar",
        "bn_name": "ডাসার",
        "lat": 23.164102,
        "lng": 90.1896805
      },
      {
        "id": "383",
        "name": "Kalkini",
        "bn_name": "কালকিনি",
        "lat": 23.164102,
        "lng": 90.1896805
      },
      {
        "id": "381",
        "name": "Madaripur Sadar",
        "bn_name": "মাদারীপুর সদর",
        "lat": 23.164102,
        "lng": 90.1896805
      },
      {
        "id": "384",
        "name": "Rajoir",
        "bn_name": "রাজৈর",
        "lat": 23.164102,
        "lng": 90.1896805
      },
      {
        "id": "382",
        "name": "Shibchar",
        "bn_name": "শিবচর",
        "lat": 23.164102,
        "lng": 90.1896805
      }
    ]
  },
  {
    "id": "26",
    "name": "Magura",
    "bn_name": "মাগুরা",
    "lat": 23.487337,
    "lng": 89.419956,
    "upazilas": [
      {
        "id": "204",
        "name": "Magura Sadar",
        "bn_name": "মাগুরা সদর",
        "lat": 23.487337,
        "lng": 89.419956
      },
      {
        "id": "205",
        "name": "Mohammadpur",
        "bn_name": "মহম্মদপুর",
        "lat": 23.487337,
        "lng": 89.419956
      },
      {
        "id": "202",
        "name": "Shalikha",
        "bn_name": "শালিখা",
        "lat": 23.487337,
        "lng": 89.419956
      },
      {
        "id": "203",
        "name": "Sreepur",
        "bn_name": "শ্রীপুর",
        "lat": 23.487337,
        "lng": 89.419956
      }
    ]
  },
  {
    "id": "46",
    "name": "Manikganj",
    "bn_name": "মানিকগঞ্জ",
    "lat": 23.8602262,
    "lng": 90.0018293,
    "upazilas": [
      {
        "id": "363",
        "name": "Doulatpur",
        "bn_name": "দৌলতপুর",
        "lat": 23.8602262,
        "lng": 90.0018293
      },
      {
        "id": "361",
        "name": "Gior",
        "bn_name": "ঘিওর",
        "lat": 23.8602262,
        "lng": 90.0018293
      },
      {
        "id": "358",
        "name": "Harirampur",
        "bn_name": "হরিরামপুর",
        "lat": 23.8602262,
        "lng": 90.0018293
      },
      {
        "id": "360",
        "name": "Manikganj Sadar",
        "bn_name": "মানিকগঞ্জ সদর",
        "lat": 23.8602262,
        "lng": 90.0018293
      },
      {
        "id": "359",
        "name": "Saturia",
        "bn_name": "সাটুরিয়া",
        "lat": 23.8602262,
        "lng": 90.0018293
      },
      {
        "id": "362",
        "name": "Shibaloy",
        "bn_name": "শিবালয়",
        "lat": 23.8602262,
        "lng": 90.0018293
      },
      {
        "id": "364",
        "name": "Singiar",
        "bn_name": "সিংগাইর",
        "lat": 23.8602262,
        "lng": 90.0018293
      }
    ]
  },
  {
    "id": "22",
    "name": "Meherpur",
    "bn_name": "মেহেরপুর",
    "lat": 23.762213,
    "lng": 88.631821,
    "upazilas": [
      {
        "id": "188",
        "name": "Gangni",
        "bn_name": "গাংনী",
        "lat": 23.762213,
        "lng": 88.631821
      },
      {
        "id": "187",
        "name": "Meherpur Sadar",
        "bn_name": "মেহেরপুর সদর",
        "lat": 23.762213,
        "lng": 88.631821
      },
      {
        "id": "186",
        "name": "Mujibnagar",
        "bn_name": "মুজিবনগর",
        "lat": 23.762213,
        "lng": 88.631821
      }
    ]
  },
  {
    "id": "37",
    "name": "Moulvibazar",
    "bn_name": "মৌলভীবাজার",
    "lat": 24.482934,
    "lng": 91.777417,
    "upazilas": [
      {
        "id": "285",
        "name": "Barlekha",
        "bn_name": "বড়লেখা",
        "lat": 24.482934,
        "lng": 91.777417
      },
      {
        "id": "291",
        "name": "Juri",
        "bn_name": "জুড়ী",
        "lat": 24.482934,
        "lng": 91.777417
      },
      {
        "id": "286",
        "name": "Kamolganj",
        "bn_name": "কমলগঞ্জ",
        "lat": 24.482934,
        "lng": 91.777417
      },
      {
        "id": "287",
        "name": "Kulaura",
        "bn_name": "কুলাউড়া",
        "lat": 24.482934,
        "lng": 91.777417
      },
      {
        "id": "288",
        "name": "Moulvibazar Sadar",
        "bn_name": "মৌলভীবাজার সদর",
        "lat": 24.482934,
        "lng": 91.777417
      },
      {
        "id": "289",
        "name": "Rajnagar",
        "bn_name": "রাজনগর",
        "lat": 24.482934,
        "lng": 91.777417
      },
      {
        "id": "290",
        "name": "Sreemangal",
        "bn_name": "শ্রীমঙ্গল",
        "lat": 24.482934,
        "lng": 91.777417
      }
    ]
  },
  {
    "id": "48",
    "name": "Munshiganj",
    "bn_name": "মুন্সিগঞ্জ",
    "lat": 23.5435742,
    "lng": 90.5354327,
    "upazilas": [
      {
        "id": "374",
        "name": "Gajaria",
        "bn_name": "গজারিয়া",
        "lat": 23.5435742,
        "lng": 90.5354327
      },
      {
        "id": "373",
        "name": "Louhajanj",
        "bn_name": "লৌহজং",
        "lat": 23.5435742,
        "lng": 90.5354327
      },
      {
        "id": "370",
        "name": "Munshiganj Sadar",
        "bn_name": "মুন্সিগঞ্জ সদর",
        "lat": 23.5435742,
        "lng": 90.5354327
      },
      {
        "id": "372",
        "name": "Sirajdikhan",
        "bn_name": "সিরাজদিখান",
        "lat": 23.5435742,
        "lng": 90.5354327
      },
      {
        "id": "371",
        "name": "Sreenagar",
        "bn_name": "শ্রীনগর",
        "lat": 23.5435742,
        "lng": 90.5354327
      },
      {
        "id": "375",
        "name": "Tongibari",
        "bn_name": "টংগীবাড়ি",
        "lat": 23.5435742,
        "lng": 90.5354327
      }
    ]
  },
  {
    "id": "62",
    "name": "Mymensingh",
    "bn_name": "ময়মনসিংহ",
    "lat": 24.746567,
    "lng": 90.4072093,
    "upazilas": [
      {
        "id": "464",
        "name": "Bhaluka",
        "bn_name": "ভালুকা",
        "lat": 24.746567,
        "lng": 90.4072093
      },
      {
        "id": "467",
        "name": "Dhobaura",
        "bn_name": "ধোবাউড়া",
        "lat": 24.746567,
        "lng": 90.4072093
      },
      {
        "id": "462",
        "name": "Fulbaria",
        "bn_name": "ফুলবাড়ীয়া",
        "lat": 24.746567,
        "lng": 90.4072093
      },
      {
        "id": "471",
        "name": "Gafargaon",
        "bn_name": "গফরগাঁও",
        "lat": 24.746567,
        "lng": 90.4072093
      },
      {
        "id": "470",
        "name": "Gouripur",
        "bn_name": "গৌরীপুর",
        "lat": 24.746567,
        "lng": 90.4072093
      },
      {
        "id": "469",
        "name": "Haluaghat",
        "bn_name": "হালুয়াঘাট",
        "lat": 24.746567,
        "lng": 90.4072093
      },
      {
        "id": "472",
        "name": "Iswarganj",
        "bn_name": "ঈশ্বরগঞ্জ",
        "lat": 24.746567,
        "lng": 90.4072093
      },
      {
        "id": "465",
        "name": "Muktagacha",
        "bn_name": "মুক্তাগাছা",
        "lat": 24.746567,
        "lng": 90.4072093
      },
      {
        "id": "466",
        "name": "Mymensingh Sadar",
        "bn_name": "ময়মনসিংহ সদর",
        "lat": 24.746567,
        "lng": 90.4072093
      },
      {
        "id": "473",
        "name": "Nandail",
        "bn_name": "নান্দাইল",
        "lat": 24.746567,
        "lng": 90.4072093
      },
      {
        "id": "468",
        "name": "Phulpur",
        "bn_name": "ফুলপুর",
        "lat": 24.746567,
        "lng": 90.4072093
      },
      {
        "id": "474",
        "name": "Tarakanda",
        "bn_name": "তারাকান্দা",
        "lat": 24.746567,
        "lng": 90.4072093
      },
      {
        "id": "463",
        "name": "Trishal",
        "bn_name": "ত্রিশাল",
        "lat": 24.746567,
        "lng": 90.4072093
      }
    ]
  },
  {
    "id": "19",
    "name": "Naogaon",
    "bn_name": "নওগাঁ",
    "lat": 24.83256191,
    "lng": 88.92485205,
    "upazilas": [
      {
        "id": "166",
        "name": "Atrai",
        "bn_name": "আত্রাই",
        "lat": 24.83256191,
        "lng": 88.92485205
      },
      {
        "id": "161",
        "name": "Badalgachi",
        "bn_name": "বদলগাছী",
        "lat": 24.83256191,
        "lng": 88.92485205
      },
      {
        "id": "163",
        "name": "Dhamoirhat",
        "bn_name": "ধামইরহাট",
        "lat": 24.83256191,
        "lng": 88.92485205
      },
      {
        "id": "165",
        "name": "Manda",
        "bn_name": "মান্দা",
        "lat": 24.83256191,
        "lng": 88.92485205
      },
      {
        "id": "160",
        "name": "Mohadevpur",
        "bn_name": "মহাদেবপুর",
        "lat": 24.83256191,
        "lng": 88.92485205
      },
      {
        "id": "168",
        "name": "Naogaon Sadar",
        "bn_name": "নওগাঁ সদর",
        "lat": 24.83256191,
        "lng": 88.92485205
      },
      {
        "id": "164",
        "name": "Niamatpur",
        "bn_name": "নিয়ামতপুর",
        "lat": 24.83256191,
        "lng": 88.92485205
      },
      {
        "id": "162",
        "name": "Patnitala",
        "bn_name": "পত্নিতলা",
        "lat": 24.83256191,
        "lng": 88.92485205
      },
      {
        "id": "169",
        "name": "Porsha",
        "bn_name": "পোরশা",
        "lat": 24.83256191,
        "lng": 88.92485205
      },
      {
        "id": "167",
        "name": "Raninagar",
        "bn_name": "রাণীনগর",
        "lat": 24.83256191,
        "lng": 88.92485205
      },
      {
        "id": "170",
        "name": "Sapahar",
        "bn_name": "সাপাহার",
        "lat": 24.83256191,
        "lng": 88.92485205
      }
    ]
  },
  {
    "id": "23",
    "name": "Narail",
    "bn_name": "নড়াইল",
    "lat": 23.172534,
    "lng": 89.512672,
    "upazilas": [
      {
        "id": "191",
        "name": "Kalia",
        "bn_name": "কালিয়া",
        "lat": 23.172534,
        "lng": 89.512672
      },
      {
        "id": "190",
        "name": "Lohagara",
        "bn_name": "লোহাগড়া",
        "lat": 23.172534,
        "lng": 89.512672
      },
      {
        "id": "189",
        "name": "Narail Sadar",
        "bn_name": "নড়াইল সদর",
        "lat": 23.172534,
        "lng": 89.512672
      }
    ]
  },
  {
    "id": "43",
    "name": "Narayanganj",
    "bn_name": "নারায়ণগঞ্জ",
    "lat": 23.63366,
    "lng": 90.496482,
    "upazilas": [
      {
        "id": "328",
        "name": "Araihazar",
        "bn_name": "আড়াইহাজার",
        "lat": 23.63366,
        "lng": 90.496482
      },
      {
        "id": "329",
        "name": "Bandar",
        "bn_name": "বন্দর",
        "lat": 23.63366,
        "lng": 90.496482
      },
      {
        "id": "330",
        "name": "Narayanganj Sadar",
        "bn_name": "নারায়নগঞ্জ সদর",
        "lat": 23.63366,
        "lng": 90.496482
      },
      {
        "id": "331",
        "name": "Rupganj",
        "bn_name": "রূপগঞ্জ",
        "lat": 23.63366,
        "lng": 90.496482
      },
      {
        "id": "332",
        "name": "Sonargaon",
        "bn_name": "সোনারগাঁ",
        "lat": 23.63366,
        "lng": 90.496482
      }
    ]
  },
  {
    "id": "40",
    "name": "Narsingdi",
    "bn_name": "নরসিংদী",
    "lat": 23.932233,
    "lng": 90.71541,
    "upazilas": [
      {
        "id": "311",
        "name": "Belabo",
        "bn_name": "বেলাবো",
        "lat": 23.932233,
        "lng": 90.71541
      },
      {
        "id": "312",
        "name": "Monohardi",
        "bn_name": "মনোহরদী",
        "lat": 23.932233,
        "lng": 90.71541
      },
      {
        "id": "313",
        "name": "Narsingdi Sadar",
        "bn_name": "নরসিংদী সদর",
        "lat": 23.932233,
        "lng": 90.71541
      },
      {
        "id": "314",
        "name": "Palash",
        "bn_name": "পলাশ",
        "lat": 23.932233,
        "lng": 90.71541
      },
      {
        "id": "315",
        "name": "Raipura",
        "bn_name": "রায়পুরা",
        "lat": 23.932233,
        "lng": 90.71541
      },
      {
        "id": "316",
        "name": "Shibpur",
        "bn_name": "শিবপুর",
        "lat": 23.932233,
        "lng": 90.71541
      }
    ]
  },
  {
    "id": "16",
    "name": "Natore",
    "bn_name": "নাটোর",
    "lat": 24.420556,
    "lng": 89.000282,
    "upazilas": [
      {
        "id": "146",
        "name": "Bagatipara",
        "bn_name": "বাগাতিপাড়া",
        "lat": 24.420556,
        "lng": 89.000282
      },
      {
        "id": "145",
        "name": "Baraigram",
        "bn_name": "বড়াইগ্রাম",
        "lat": 24.420556,
        "lng": 89.000282
      },
      {
        "id": "148",
        "name": "Gurudaspur",
        "bn_name": "গুরুদাসপুর",
        "lat": 24.420556,
        "lng": 89.000282
      },
      {
        "id": "147",
        "name": "Lalpur",
        "bn_name": "লালপুর",
        "lat": 24.420556,
        "lng": 89.000282
      },
      {
        "id": "149",
        "name": "Naldanga",
        "bn_name": "নলডাঙ্গা",
        "lat": 24.420556,
        "lng": 89.000282
      },
      {
        "id": "143",
        "name": "Natore Sadar",
        "bn_name": "নাটোর সদর",
        "lat": 24.420556,
        "lng": 89.000282
      },
      {
        "id": "144",
        "name": "Singra",
        "bn_name": "সিংড়া",
        "lat": 24.420556,
        "lng": 89.000282
      }
    ]
  },
  {
    "id": "64",
    "name": "Netrokona",
    "bn_name": "নেত্রকোণা",
    "lat": 24.870955,
    "lng": 90.727887,
    "upazilas": [
      {
        "id": "485",
        "name": "Atpara",
        "bn_name": "আটপাড়া",
        "lat": 24.870955,
        "lng": 90.727887
      },
      {
        "id": "482",
        "name": "Barhatta",
        "bn_name": "বারহাট্টা",
        "lat": 24.870955,
        "lng": 90.727887
      },
      {
        "id": "483",
        "name": "Durgapur",
        "bn_name": "দুর্গাপুর",
        "lat": 24.870955,
        "lng": 90.727887
      },
      {
        "id": "488",
        "name": "Kalmakanda",
        "bn_name": "কলমাকান্দা",
        "lat": 24.870955,
        "lng": 90.727887
      },
      {
        "id": "484",
        "name": "Kendua",
        "bn_name": "কেন্দুয়া",
        "lat": 24.870955,
        "lng": 90.727887
      },
      {
        "id": "487",
        "name": "Khaliajuri",
        "bn_name": "খালিয়াজুরী",
        "lat": 24.870955,
        "lng": 90.727887
      },
      {
        "id": "486",
        "name": "Madan",
        "bn_name": "মদন",
        "lat": 24.870955,
        "lng": 90.727887
      },
      {
        "id": "489",
        "name": "Mohongonj",
        "bn_name": "মোহনগঞ্জ",
        "lat": 24.870955,
        "lng": 90.727887
      },
      {
        "id": "491",
        "name": "Netrokona Sadar",
        "bn_name": "নেত্রকোণা সদর",
        "lat": 24.870955,
        "lng": 90.727887
      },
      {
        "id": "490",
        "name": "Purbadhala",
        "bn_name": "পূর্বধলা",
        "lat": 24.870955,
        "lng": 90.727887
      }
    ]
  },
  {
    "id": "56",
    "name": "Nilphamari",
    "bn_name": "নীলফামারী",
    "lat": 25.931794,
    "lng": 88.856006,
    "upazilas": [
      {
        "id": "424",
        "name": "Dimla",
        "bn_name": "ডিমলা",
        "lat": 25.931794,
        "lng": 88.856006
      },
      {
        "id": "423",
        "name": "Domar",
        "bn_name": "ডোমার",
        "lat": 25.931794,
        "lng": 88.856006
      },
      {
        "id": "425",
        "name": "Jaldhaka",
        "bn_name": "জলঢাকা",
        "lat": 25.931794,
        "lng": 88.856006
      },
      {
        "id": "426",
        "name": "Kishorganj",
        "bn_name": "কিশোরগঞ্জ",
        "lat": 25.931794,
        "lng": 88.856006
      },
      {
        "id": "427",
        "name": "Nilphamari Sadar",
        "bn_name": "নীলফামারী সদর",
        "lat": 25.931794,
        "lng": 88.856006
      },
      {
        "id": "422",
        "name": "Syedpur",
        "bn_name": "সৈয়দপুর",
        "lat": 25.931794,
        "lng": 88.856006
      }
    ]
  },
  {
    "id": "5",
    "name": "Noakhali",
    "bn_name": "নোয়াখালী",
    "lat": 22.869563,
    "lng": 91.099398,
    "upazilas": [
      {
        "id": "45",
        "name": "Begumganj",
        "bn_name": "বেগমগঞ্জ",
        "lat": 22.869563,
        "lng": 91.099398
      },
      {
        "id": "50",
        "name": "Chatkhil",
        "bn_name": "চাটখিল",
        "lat": 22.869563,
        "lng": 91.099398
      },
      {
        "id": "44",
        "name": "Companiganj",
        "bn_name": "কোম্পানীগঞ্জ",
        "lat": 22.869563,
        "lng": 91.099398
      },
      {
        "id": "46",
        "name": "Hatia",
        "bn_name": "হাতিয়া",
        "lat": 22.869563,
        "lng": 91.099398
      },
      {
        "id": "48",
        "name": "Kabirhat",
        "bn_name": "কবিরহাট",
        "lat": 22.869563,
        "lng": 91.099398
      },
      {
        "id": "43",
        "name": "Noakhali Sadar",
        "bn_name": "নোয়াখালী সদর",
        "lat": 22.869563,
        "lng": 91.099398
      },
      {
        "id": "49",
        "name": "Senbug",
        "bn_name": "সেনবাগ",
        "lat": 22.869563,
        "lng": 91.099398
      },
      {
        "id": "51",
        "name": "Sonaimori",
        "bn_name": "সোনাইমুড়ী",
        "lat": 22.869563,
        "lng": 91.099398
      },
      {
        "id": "47",
        "name": "Subarnachar",
        "bn_name": "সুবর্ণচর",
        "lat": 22.869563,
        "lng": 91.099398
      }
    ]
  },
  {
    "id": "13",
    "name": "Pabna",
    "bn_name": "পাবনা",
    "lat": 23.998524,
    "lng": 89.233645,
    "upazilas": [
      {
        "id": "118",
        "name": "Atghoria",
        "bn_name": "আটঘরিয়া",
        "lat": 23.998524,
        "lng": 89.233645
      },
      {
        "id": "117",
        "name": "Bera",
        "bn_name": "বেড়া",
        "lat": 23.998524,
        "lng": 89.233645
      },
      {
        "id": "115",
        "name": "Bhangura",
        "bn_name": "ভাঙ্গুড়া",
        "lat": 23.998524,
        "lng": 89.233645
      },
      {
        "id": "119",
        "name": "Chatmohar",
        "bn_name": "চাটমোহর",
        "lat": 23.998524,
        "lng": 89.233645
      },
      {
        "id": "121",
        "name": "Faridpur",
        "bn_name": "ফরিদপুর",
        "lat": 23.998524,
        "lng": 89.233645
      },
      {
        "id": "114",
        "name": "Ishurdi",
        "bn_name": "ঈশ্বরদী",
        "lat": 23.998524,
        "lng": 89.233645
      },
      {
        "id": "116",
        "name": "Pabna Sadar",
        "bn_name": "পাবনা সদর",
        "lat": 23.998524,
        "lng": 89.233645
      },
      {
        "id": "120",
        "name": "Santhia",
        "bn_name": "সাঁথিয়া",
        "lat": 23.998524,
        "lng": 89.233645
      },
      {
        "id": "113",
        "name": "Sujanagar",
        "bn_name": "সুজানগর",
        "lat": 23.998524,
        "lng": 89.233645
      }
    ]
  },
  {
    "id": "53",
    "name": "Panchagarh",
    "bn_name": "পঞ্চগড়",
    "lat": 26.3411,
    "lng": 88.5541606,
    "upazilas": [
      {
        "id": "402",
        "name": "Atwari",
        "bn_name": "আটোয়ারী",
        "lat": 26.3411,
        "lng": 88.5541606
      },
      {
        "id": "401",
        "name": "Boda",
        "bn_name": "বোদা",
        "lat": 26.3411,
        "lng": 88.5541606
      },
      {
        "id": "400",
        "name": "Debiganj",
        "bn_name": "দেবীগঞ্জ",
        "lat": 26.3411,
        "lng": 88.5541606
      },
      {
        "id": "399",
        "name": "Panchagarh Sadar",
        "bn_name": "পঞ্চগড় সদর",
        "lat": 26.3411,
        "lng": 88.5541606
      },
      {
        "id": "403",
        "name": "Tetulia",
        "bn_name": "তেতুলিয়া",
        "lat": 26.3411,
        "lng": 88.5541606
      }
    ]
  },
  {
    "id": "31",
    "name": "Patuakhali",
    "bn_name": "পটুয়াখালী",
    "lat": 22.3596316,
    "lng": 90.3298712,
    "upazilas": [
      {
        "id": "234",
        "name": "Bauphal",
        "bn_name": "বাউফল",
        "lat": 22.3596316,
        "lng": 90.3298712
      },
      {
        "id": "237",
        "name": "Dashmina",
        "bn_name": "দশমিনা",
        "lat": 22.3596316,
        "lng": 90.3298712
      },
      {
        "id": "236",
        "name": "Dumki",
        "bn_name": "দুমকি",
        "lat": 22.3596316,
        "lng": 90.3298712
      },
      {
        "id": "240",
        "name": "Galachipa",
        "bn_name": "গলাচিপা",
        "lat": 22.3596316,
        "lng": 90.3298712
      },
      {
        "id": "238",
        "name": "Kalapara",
        "bn_name": "কলাপাড়া",
        "lat": 22.3596316,
        "lng": 90.3298712
      },
      {
        "id": "239",
        "name": "Mirzaganj",
        "bn_name": "মির্জাগঞ্জ",
        "lat": 22.3596316,
        "lng": 90.3298712
      },
      {
        "id": "235",
        "name": "Patuakhali Sadar",
        "bn_name": "পটুয়াখালী সদর",
        "lat": 22.3596316,
        "lng": 90.3298712
      },
      {
        "id": "241",
        "name": "Rangabali",
        "bn_name": "রাঙ্গাবালী",
        "lat": 22.3596316,
        "lng": 90.3298712
      }
    ]
  },
  {
    "id": "32",
    "name": "Pirojpur",
    "bn_name": "পিরোজপুর",
    "lat": 22.5781398,
    "lng": 89.9983909,
    "upazilas": [
      {
        "id": "246",
        "name": "Bhandaria",
        "bn_name": "ভান্ডারিয়া",
        "lat": 22.5781398,
        "lng": 89.9983909
      },
      {
        "id": "244",
        "name": "Kawkhali",
        "bn_name": "কাউখালী",
        "lat": 22.5781398,
        "lng": 89.9983909
      },
      {
        "id": "247",
        "name": "Mathbaria",
        "bn_name": "মঠবাড়ীয়া",
        "lat": 22.5781398,
        "lng": 89.9983909
      },
      {
        "id": "243",
        "name": "Nazirpur",
        "bn_name": "নাজিরপুর",
        "lat": 22.5781398,
        "lng": 89.9983909
      },
      {
        "id": "248",
        "name": "Nesarabad",
        "bn_name": "নেছারাবাদ",
        "lat": 22.5781398,
        "lng": 89.9983909
      },
      {
        "id": "242",
        "name": "Pirojpur Sadar",
        "bn_name": "পিরোজপুর সদর",
        "lat": 22.5781398,
        "lng": 89.9983909
      },
      {
        "id": "245",
        "name": "Zianagar",
        "bn_name": "জিয়ানগর",
        "lat": 22.5781398,
        "lng": 89.9983909
      }
    ]
  },
  {
    "id": "49",
    "name": "Rajbari",
    "bn_name": "রাজবাড়ী",
    "lat": 23.7574305,
    "lng": 89.6444665,
    "upazilas": [
      {
        "id": "379",
        "name": "Baliakandi",
        "bn_name": "বালিয়াকান্দি",
        "lat": 23.7574305,
        "lng": 89.6444665
      },
      {
        "id": "377",
        "name": "Goalanda",
        "bn_name": "গোয়ালন্দ",
        "lat": 23.7574305,
        "lng": 89.6444665
      },
      {
        "id": "380",
        "name": "Kalukhali",
        "bn_name": "কালুখালী",
        "lat": 23.7574305,
        "lng": 89.6444665
      },
      {
        "id": "378",
        "name": "Pangsa",
        "bn_name": "পাংশা",
        "lat": 23.7574305,
        "lng": 89.6444665
      },
      {
        "id": "376",
        "name": "Rajbari Sadar",
        "bn_name": "রাজবাড়ী সদর",
        "lat": 23.7574305,
        "lng": 89.6444665
      }
    ]
  },
  {
    "id": "15",
    "name": "Rajshahi",
    "bn_name": "রাজশাহী",
    "lat": 24.37230298,
    "lng": 88.56307623,
    "upazilas": [
      {
        "id": "139",
        "name": "Bagha",
        "bn_name": "বাঘা",
        "lat": 24.37230298,
        "lng": 88.56307623
      },
      {
        "id": "142",
        "name": "Bagmara",
        "bn_name": "বাগমারা",
        "lat": 24.37230298,
        "lng": 88.56307623
      },
      {
        "id": "137",
        "name": "Charghat",
        "bn_name": "চারঘাট",
        "lat": 24.37230298,
        "lng": 88.56307623
      },
      {
        "id": "135",
        "name": "Durgapur",
        "bn_name": "দু���্গাপুর",
        "lat": 24.37230298,
        "lng": 88.56307623
      },
      {
        "id": "140",
        "name": "Godagari",
        "bn_name": "গোদাগাড়ী",
        "lat": 24.37230298,
        "lng": 88.56307623
      },
      {
        "id": "136",
        "name": "Mohonpur",
        "bn_name": "মোহনপুর",
        "lat": 24.37230298,
        "lng": 88.56307623
      },
      {
        "id": "134",
        "name": "Paba",
        "bn_name": "পবা",
        "lat": 24.37230298,
        "lng": 88.56307623
      },
      {
        "id": "138",
        "name": "Puthia",
        "bn_name": "পুঠিয়া",
        "lat": 24.37230298,
        "lng": 88.56307623
      },
      {
        "id": "141",
        "name": "Tanore",
        "bn_name": "তানোর",
        "lat": 24.37230298,
        "lng": 88.56307623
      }
    ]
  },
  {
    "id": "4",
    "name": "Rangamati",
    "bn_name": "রাঙ্গামাটি",
    "lat": 22.65561018,
    "lng": 92.17541121,
    "upazilas": [
      {
        "id": "36",
        "name": "Baghaichari",
        "bn_name": "বাঘাইছড়ি",
        "lat": 22.65561018,
        "lng": 92.17541121
      },
      {
        "id": "37",
        "name": "Barkal",
        "bn_name": "বরকল",
        "lat": 22.65561018,
        "lng": 92.17541121
      },
      {
        "id": "40",
        "name": "Belaichari",
        "bn_name": "বিলাইছড়ি",
        "lat": 22.65561018,
        "lng": 92.17541121
      },
      {
        "id": "41",
        "name": "Juraichari",
        "bn_name": "জুরাছড়ি",
        "lat": 22.65561018,
        "lng": 92.17541121
      },
      {
        "id": "34",
        "name": "Kaptai",
        "bn_name": "কাপ্তাই",
        "lat": 22.65561018,
        "lng": 92.17541121
      },
      {
        "id": "35",
        "name": "Kawkhali",
        "bn_name": "কাউখালী",
        "lat": 22.65561018,
        "lng": 92.17541121
      },
      {
        "id": "38",
        "name": "Langadu",
        "bn_name": "লংগদু",
        "lat": 22.65561018,
        "lng": 92.17541121
      },
      {
        "id": "42",
        "name": "Naniarchar",
        "bn_name": "নানিয়ারচর",
        "lat": 22.65561018,
        "lng": 92.17541121
      },
      {
        "id": "39",
        "name": "Rajasthali",
        "bn_name": "রাজস্থলী",
        "lat": 22.65561018,
        "lng": 92.17541121
      },
      {
        "id": "33",
        "name": "Rangamati Sadar",
        "bn_name": "রাঙ্গামাটি সদর",
        "lat": 22.65561018,
        "lng": 92.17541121
      }
    ]
  },
  {
    "id": "59",
    "name": "Rangpur",
    "bn_name": "রংপুর",
    "lat": 25.7558096,
    "lng": 89.244462,
    "upazilas": [
      {
        "id": "443",
        "name": "Badargonj",
        "bn_name": "বদরগঞ্জ",
        "lat": 25.7558096,
        "lng": 89.244462
      },
      {
        "id": "441",
        "name": "Gangachara",
        "bn_name": "গংগাচড়া",
        "lat": 25.7558096,
        "lng": 89.244462
      },
      {
        "id": "446",
        "name": "Kaunia",
        "bn_name": "কাউনিয়া",
        "lat": 25.7558096,
        "lng": 89.244462
      },
      {
        "id": "444",
        "name": "Mithapukur",
        "bn_name": "মিঠাপুকুর",
        "lat": 25.7558096,
        "lng": 89.244462
      },
      {
        "id": "447",
        "name": "Pirgacha",
        "bn_name": "পীরগাছা",
        "lat": 25.7558096,
        "lng": 89.244462
      },
      {
        "id": "445",
        "name": "Pirgonj",
        "bn_name": "পীরগঞ্জ",
        "lat": 25.7558096,
        "lng": 89.244462
      },
      {
        "id": "440",
        "name": "Rangpur Sadar",
        "bn_name": "রংপুর সদর",
        "lat": 25.7558096,
        "lng": 89.244462
      },
      {
        "id": "442",
        "name": "Taragonj",
        "bn_name": "তারাগঞ্জ",
        "lat": 25.7558096,
        "lng": 89.244462
      }
    ]
  },
  {
    "id": "21",
    "name": "Satkhira",
    "bn_name": "সাতক্ষীরা",
    "lat": 22.7180905,
    "lng": 89.0687033,
    "upazilas": [
      {
        "id": "179",
        "name": "Assasuni",
        "bn_name": "আশাশুনি",
        "lat": 22.7180905,
        "lng": 89.0687033
      },
      {
        "id": "180",
        "name": "Debhata",
        "bn_name": "দেবহাটা",
        "lat": 22.7180905,
        "lng": 89.0687033
      },
      {
        "id": "181",
        "name": "Kalaroa",
        "bn_name": "কলারোয়া",
        "lat": 22.7180905,
        "lng": 89.0687033
      },
      {
        "id": "185",
        "name": "Kaliganj",
        "bn_name": "কালিগঞ্জ",
        "lat": 22.7180905,
        "lng": 89.0687033
      },
      {
        "id": "182",
        "name": "Satkhira Sadar",
        "bn_name": "সাতক্ষীরা সদর",
        "lat": 22.7180905,
        "lng": 89.0687033
      },
      {
        "id": "183",
        "name": "Shyamnagar",
        "bn_name": "শ্যামনগর",
        "lat": 22.7180905,
        "lng": 89.0687033
      },
      {
        "id": "184",
        "name": "Tala",
        "bn_name": "তালা",
        "lat": 22.7180905,
        "lng": 89.0687033
      }
    ]
  },
  {
    "id": "42",
    "name": "Shariatpur",
    "bn_name": "শরীয়তপুর",
    "lat": 23.2060195,
    "lng": 90.3477725,
    "upazilas": [
      {
        "id": "326",
        "name": "Bhedarganj",
        "bn_name": "ভেদরগঞ্জ",
        "lat": 23.2060195,
        "lng": 90.3477725
      },
      {
        "id": "327",
        "name": "Damudya",
        "bn_name": "ডামুড্যা",
        "lat": 23.2060195,
        "lng": 90.3477725
      },
      {
        "id": "325",
        "name": "Gosairhat",
        "bn_name": "গোসাইরহাট",
        "lat": 23.2060195,
        "lng": 90.3477725
      },
      {
        "id": "323",
        "name": "Naria",
        "bn_name": "নড়িয়া",
        "lat": 23.2060195,
        "lng": 90.3477725
      },
      {
        "id": "322",
        "name": "Shariatpur Sadar",
        "bn_name": "শরিয়তপুর সদর",
        "lat": 23.2060195,
        "lng": 90.3477725
      },
      {
        "id": "324",
        "name": "Zajira",
        "bn_name": "জাজিরা",
        "lat": 23.2060195,
        "lng": 90.3477725
      }
    ]
  },
  {
    "id": "61",
    "name": "Sherpur",
    "bn_name": "শেরপুর",
    "lat": 25.0204933,
    "lng": 90.0152966,
    "upazilas": [
      {
        "id": "461",
        "name": "Jhenaigati",
        "bn_name": "ঝিনাইগাতী",
        "lat": 25.0204933,
        "lng": 90.0152966
      },
      {
        "id": "458",
        "name": "Nalitabari",
        "bn_name": "নালিতাবাড়ী",
        "lat": 25.0204933,
        "lng": 90.0152966
      },
      {
        "id": "460",
        "name": "Nokla",
        "bn_name": "নকলা",
        "lat": 25.0204933,
        "lng": 90.0152966
      },
      {
        "id": "457",
        "name": "Sherpur Sadar",
        "bn_name": "শেরপুর সদর",
        "lat": 25.0204933,
        "lng": 90.0152966
      },
      {
        "id": "459",
        "name": "Sreebordi",
        "bn_name": "শ্রীবরদী",
        "lat": 25.0204933,
        "lng": 90.0152966
      }
    ]
  },
  {
    "id": "12",
    "name": "Sirajganj",
    "bn_name": "সিরাজগঞ্জ",
    "lat": 24.4533978,
    "lng": 89.7006815,
    "upazilas": [
      {
        "id": "104",
        "name": "Belkuchi",
        "bn_name": "বেলকুচি",
        "lat": 24.4533978,
        "lng": 89.7006815
      },
      {
        "id": "105",
        "name": "Chauhali",
        "bn_name": "চৌহালি",
        "lat": 24.4533978,
        "lng": 89.7006815
      },
      {
        "id": "106",
        "name": "Kamarkhand",
        "bn_name": "কামারখন্দ",
        "lat": 24.4533978,
        "lng": 89.7006815
      },
      {
        "id": "107",
        "name": "Kazipur",
        "bn_name": "কাজীপুর",
        "lat": 24.4533978,
        "lng": 89.7006815
      },
      {
        "id": "108",
        "name": "Raigonj",
        "bn_name": "রায়গঞ্জ",
        "lat": 24.4533978,
        "lng": 89.7006815
      },
      {
        "id": "109",
        "name": "Shahjadpur",
        "bn_name": "শাহজাদপুর",
        "lat": 24.4533978,
        "lng": 89.7006815
      },
      {
        "id": "110",
        "name": "Sirajganj Sadar",
        "bn_name": "সিরাজগঞ্জ সদর",
        "lat": 24.4533978,
        "lng": 89.7006815
      },
      {
        "id": "111",
        "name": "Tarash",
        "bn_name": "তাড়াশ",
        "lat": 24.4533978,
        "lng": 89.7006815
      },
      {
        "id": "112",
        "name": "Ullapara",
        "bn_name": "উল্লাপাড়া",
        "lat": 24.4533978,
        "lng": 89.7006815
      }
    ]
  },
  {
    "id": "39",
    "name": "Sunamganj",
    "bn_name": "সুনামগঞ্জ",
    "lat": 25.0658042,
    "lng": 91.3950115,
    "upazilas": [
      {
        "id": "302",
        "name": "Bishwambarpur",
        "bn_name": "বিশ্বম্ভরপুর",
        "lat": 25.0658042,
        "lng": 91.3950115
      },
      {
        "id": "303",
        "name": "Chhatak",
        "bn_name": "ছাতক",
        "lat": 25.0658042,
        "lng": 91.3950115
      },
      {
        "id": "310",
        "name": "Derai",
        "bn_name": "দিরাই",
        "lat": 25.0658042,
        "lng": 91.3950115
      },
      {
        "id": "307",
        "name": "Dharmapasha",
        "bn_name": "ধর্মপাশা",
        "lat": 25.0658042,
        "lng": 91.3950115
      },
      {
        "id": "305",
        "name": "Dowarabazar",
        "bn_name": "দোয়ারাবাজার",
        "lat": 25.0658042,
        "lng": 91.3950115
      },
      {
        "id": "304",
        "name": "Jagannathpur",
        "bn_name": "জগন্নাথপুর",
        "lat": 25.0658042,
        "lng": 91.3950115
      },
      {
        "id": "308",
        "name": "Jamalganj",
        "bn_name": "জামালগঞ্জ",
        "lat": 25.0658042,
        "lng": 91.3950115
      },
      {
        "id": "493",
        "name": "Madhyanagar",
        "bn_name": "মধ্যনগর",
        "lat": 25.0658042,
        "lng": 91.3950115
      },
      {
        "id": "309",
        "name": "Shalla",
        "bn_name": "শাল্লা",
        "lat": 25.0658042,
        "lng": 91.3950115
      },
      {
        "id": "301",
        "name": "South Sunamganj",
        "bn_name": "দক্ষিণ সুনামগঞ্জ",
        "lat": 25.0658042,
        "lng": 91.3950115
      },
      {
        "id": "300",
        "name": "Sunamganj Sadar",
        "bn_name": "সুনামগঞ্জ সদর",
        "lat": 25.0658042,
        "lng": 91.3950115
      },
      {
        "id": "306",
        "name": "Tahirpur",
        "bn_name": "তাহিরপুর",
        "lat": 25.0658042,
        "lng": 91.3950115
      }
    ]
  },
  {
    "id": "36",
    "name": "Sylhet",
    "bn_name": "সিলেট",
    "lat": 24.8897956,
    "lng": 91.8697894,
    "upazilas": [
      {
        "id": "272",
        "name": "Balaganj",
        "bn_name": "বালাগঞ্জ",
        "lat": 24.8897956,
        "lng": 91.8697894
      },
      {
        "id": "273",
        "name": "Beanibazar",
        "bn_name": "বিয়ানীবাজার",
        "lat": 24.8897956,
        "lng": 91.8697894
      },
      {
        "id": "274",
        "name": "Bishwanath",
        "bn_name": "বিশ্বনাথ",
        "lat": 24.8897956,
        "lng": 91.8697894
      },
      {
        "id": "275",
        "name": "Companiganj",
        "bn_name": "কোম্পানীগঞ্জ",
        "lat": 24.8897956,
        "lng": 91.8697894
      },
      {
        "id": "283",
        "name": "Dakshinsurma",
        "bn_name": "দক্ষিণ সুরমা",
        "lat": 24.8897956,
        "lng": 91.8697894
      },
      {
        "id": "276",
        "name": "Fenchuganj",
        "bn_name": "ফেঞ্চুগঞ্জ",
        "lat": 24.8897956,
        "lng": 91.8697894
      },
      {
        "id": "277",
        "name": "Golapganj",
        "bn_name": "গোলাপগঞ্জ",
        "lat": 24.8897956,
        "lng": 91.8697894
      },
      {
        "id": "278",
        "name": "Gowainghat",
        "bn_name": "গোয়াইনঘাট",
        "lat": 24.8897956,
        "lng": 91.8697894
      },
      {
        "id": "279",
        "name": "Jaintiapur",
        "bn_name": "জৈন্তাপুর",
        "lat": 24.8897956,
        "lng": 91.8697894
      },
      {
        "id": "280",
        "name": "Kanaighat",
        "bn_name": "কানাইঘাট",
        "lat": 24.8897956,
        "lng": 91.8697894
      },
      {
        "id": "284",
        "name": "Osmaninagar",
        "bn_name": "ওসমানী নগর",
        "lat": 24.8897956,
        "lng": 91.8697894
      },
      {
        "id": "281",
        "name": "Sylhet Sadar",
        "bn_name": "সিলেট সদর",
        "lat": 24.8897956,
        "lng": 91.8697894
      },
      {
        "id": "282",
        "name": "Zakiganj",
        "bn_name": "জকিগঞ্জ",
        "lat": 24.8897956,
        "lng": 91.8697894
      }
    ]
  },
  {
    "id": "44",
    "name": "Tangail",
    "bn_name": "টাঙ্গাইল",
    "lat": 24.264145,
    "lng": 89.918029,
    "upazilas": [
      {
        "id": "333",
        "name": "Basail",
        "bn_name": "বাসাইল",
        "lat": 24.264145,
        "lng": 89.918029
      },
      {
        "id": "334",
        "name": "Bhuapur",
        "bn_name": "ভুয়াপুর",
        "lat": 24.264145,
        "lng": 89.918029
      },
      {
        "id": "335",
        "name": "Delduar",
        "bn_name": "দেলদুয়ার",
        "lat": 24.264145,
        "lng": 89.918029
      },
      {
        "id": "344",
        "name": "Dhanbari",
        "bn_name": "ধনবাড়ী",
        "lat": 24.264145,
        "lng": 89.918029
      },
      {
        "id": "336",
        "name": "Ghatail",
        "bn_name": "ঘাটাইল",
        "lat": 24.264145,
        "lng": 89.918029
      },
      {
        "id": "337",
        "name": "Gopalpur",
        "bn_name": "গোপালপুর",
        "lat": 24.264145,
        "lng": 89.918029
      },
      {
        "id": "343",
        "name": "Kalihati",
        "bn_name": "কালিহাতী",
        "lat": 24.264145,
        "lng": 89.918029
      },
      {
        "id": "338",
        "name": "Madhupur",
        "bn_name": "মধুপুর",
        "lat": 24.264145,
        "lng": 89.918029
      },
      {
        "id": "339",
        "name": "Mirzapur",
        "bn_name": "মির্জাপুর",
        "lat": 24.264145,
        "lng": 89.918029
      },
      {
        "id": "340",
        "name": "Nagarpur",
        "bn_name": "নাগরপুর",
        "lat": 24.264145,
        "lng": 89.918029
      },
      {
        "id": "341",
        "name": "Sakhipur",
        "bn_name": "সখিপুর",
        "lat": 24.264145,
        "lng": 89.918029
      },
      {
        "id": "342",
        "name": "Tangail Sadar",
        "bn_name": "টাঙ্গাইল সদর",
        "lat": 24.264145,
        "lng": 89.918029
      }
    ]
  },
  {
    "id": "58",
    "name": "Thakurgaon",
    "bn_name": "ঠাকুরগাঁও",
    "lat": 26.0336945,
    "lng": 88.4616834,
    "upazilas": [
      {
        "id": "439",
        "name": "Baliadangi",
        "bn_name": "বালিয়াডাঙ্গী",
        "lat": 26.0336945,
        "lng": 88.4616834
      },
      {
        "id": "438",
        "name": "Haripur",
        "bn_name": "হরিপুর",
        "lat": 26.0336945,
        "lng": 88.4616834
      },
      {
        "id": "436",
        "name": "Pirganj",
        "bn_name": "পীরগঞ্জ",
        "lat": 26.0336945,
        "lng": 88.4616834
      },
      {
        "id": "437",
        "name": "Ranisankail",
        "bn_name": "রাণীশংকৈল",
        "lat": 26.0336945,
        "lng": 88.4616834
      },
      {
        "id": "435",
        "name": "Thakurgaon Sadar",
        "bn_name": "ঠাকুরগাঁও সদর",
        "lat": 26.0336945,
        "lng": 88.4616834
      }
    ]
  }
];
