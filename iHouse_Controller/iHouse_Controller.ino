//RFID程式庫---------------
#include <SPI.h>
#include <MFRC522.h>
#include <Servo.h>
//------------------------
#include <StepperMotor.h>      //步進馬達程式庫
#include <SoftwareSerial.h>    //藍牙程式庫
#include <Adafruit_NeoPixel.h> //LED燈環、燈條程式庫
#include <DHT.h>               //DHT(溫溼度感測器)程式庫
#include <SimpleTimer.h>       //計時器程式庫

#define STEPS 4076          //步進馬達步數 = 4076
#define SPEED 1             //步進馬達轉速，數字愈大則速度愈慢，在5v電力下最快可達15rpm
#define LED1 2              //LED1 pin腳 = 2
#define LED2 4              //LED2 pin腳 = 4
#define RgbRed 3            //RGB LED RED pin腳 = 3
#define RgbGreen 5          //RGB LED Green pin腳 = 5
#define RgbBlue 6           //RGB LED Blue pin腳 = 6
#define Fan 13              //風扇 pin腳 = 13
#define AirCon 13           //冷氣 pin腳 = 13
#define TV 13               //電視 pin腳 = 13
#define Audio 13            //音響 pin腳 = 13
#define Buzzer 1            //蜂鳴器 pin腳 = 1
#define BtnStopRing 13      //按鈕 pin腳 = 13
#define SSpin A4            //晶片選擇腳位 pin腳 = A4
#define RSTpin A5           //讀卡機的重置腳位 pin腳 = A5
#define PIRsensor 12        //人體感測器 pin腳 = 12
#define BTrx 8              //藍芽接收腳(RX) pin腳 = 8
#define BTtx 7              //藍芽傳送腳(TX) pin腳 = 7
#define LightRing 10        //燈環 pin腳 = 10
#define LightBar 9          //燈條 pin腳 = 9
#define DHTsensor 13        //溫濕度感測器 pin腳 = 13
#define DHTsensorType DHT22 //溫濕度感測器型號
#define DHTinterval 60000L  //自動讀取溫溼度感測器資料的間隔時間(預設1分鐘)

String serverData = ""; //從伺服器接收到的資料
String btData = "";     //從藍芽接收到的資料
int currentCircle = 0;  //燈環樣式
unsigned long previousMillis = 0L;

//建立MFRC522物件 pin腳 = A4, A5
MFRC522 mfrc522(SSpin, RSTpin);
//建立步進馬達物件 pin腳 = A0, A1, A2, A3
StepperMotor stepper(A0, A1, A2, A3);
//建立藍牙物件 pin腳 = 8, 7
SoftwareSerial bluetooth(BTrx, BTtx);
//建立燈環物件 16顆LED pin腳 = 10
Adafruit_NeoPixel circleLED = Adafruit_NeoPixel(16, LightRing);
//建立燈條物件 15顆LED pin腳 = 9
Adafruit_NeoPixel barLED = Adafruit_NeoPixel(15, LightBar);
//建立溫溼度感測器物件 型號 = DHT22 pin腳 = 11
DHT dht(DHTsensor, DHTsensorType);
//建立timer以傳送溫溼度資料
SimpleTimer timer;

void setup()
{
    Serial.begin(9600);
    Serial.setTimeout(500);
    bluetooth.begin(9600);

    pinMode(LED1, OUTPUT);
    pinMode(LED2, OUTPUT);
    pinMode(RgbRed, OUTPUT);
    pinMode(RgbGreen, OUTPUT);
    pinMode(RgbBlue, OUTPUT);
    pinMode(Fan, OUTPUT);
    pinMode(AirCon, OUTPUT);
    pinMode(TV, OUTPUT);
    pinMode(Audio, OUTPUT);
    pinMode(Buzzer, OUTPUT);
    pinMode(SSpin, OUTPUT);
    pinMode(RSTpin, OUTPUT);
    pinMode(BtnStopRing, INPUT);
    pinMode(PIRsensor, INPUT);

    //RGB LED初始化至白色
    analogWrite(RgbRed, 255);
    analogWrite(RgbGreen, 255);
    analogWrite(RgbBlue, 255);

    //燈環初始化
    circleLED.begin();           //將燈條物件初始化，並設為全暗
    circleLED.setBrightness(32); //將整體亮度降為1/8
    circleLED.show();            //讓燈條顯示出所設定的狀態

    //燈條初始化為全暗
    barLED.begin();
    barLED.setBrightness(32);
    barLED.show();

    //RFID初始化
    SPI.begin();        //設定SPI bus
    mfrc522.PCD_Init(); //設定MFRC522

    //初始化DHT
    dht.begin();

    stepper.setStepDuration(SPEED);               //設定步進馬達轉速
    timer.setInterval(DHTinterval, getTempHumid); //設定timer每固定時間執行一次getTempHumid函數
}

void loop()
{
    //btDataHandler();
    //checkPIRsensor();
    checkRFID();
    timer.run();

    if (Serial.available())
    {
        char received = Serial.read();
        serverData.concat(received);

        if (received == '\n')
        {
            serverData.replace('\n', ' ');
            serverData.trim();
            bluetooth.print(serverData); //將資料傳送給藍芽模組

            if (serverData.startsWith("ledOne"))
            {
                digitalWrite(LED1, lastChar(serverData) == '0' ? LOW : HIGH);
            }
            else if (serverData.startsWith("ledTwo"))
            {
                digitalWrite(LED2, lastChar(serverData) == '0' ? LOW : HIGH);
            }
            else if (serverData.startsWith("red"))
            {
                analogWrite(RgbRed, 255 - (serverData.substring(3).toInt()));
            }
            else if (serverData.startsWith("green"))
            {
                analogWrite(RgbGreen, 255 - (serverData.substring(5).toInt()));
            }
            else if (serverData.startsWith("blue"))
            {
                analogWrite(RgbBlue, 255 - (serverData.substring(4).toInt()));
            }
            else if (serverData.startsWith("door"))
            {
                bool isOpen = lastChar(serverData) == '1';
                stepper.step((isOpen ? STEPS : -STEPS) / 4.5);
            }
            else if (serverData.startsWith("fan"))
            {
                digitalWrite(Fan, lastChar(serverData) == '0' ? LOW : HIGH);
            }
            else if (serverData.startsWith("airCon"))
            {
                digitalWrite(AirCon, lastChar(serverData) == '0' ? LOW : HIGH);
            }
            else if (serverData.startsWith("lightRing"))
            {
                currentCircle = serverData.substring(9).toInt();
                setLightRingStatus(currentCircle);
            }
            else if (serverData.startsWith("lightBar"))
            {
                enableLightBar();
            }
            else if (serverData.startsWith("tv"))
            {
                digitalWrite(TV, lastChar(serverData) == '0' ? LOW : HIGH);
            }
            else if (serverData.startsWith("audio"))
            {
                digitalWrite(Audio, lastChar(serverData) == '0' ? LOW : HIGH);
            }
            else if (serverData.startsWith("requestTempHumidData"))
            {
                respondTempHumidData();
            }

            serverData = "";
        }
    }

    unsigned long currentMillis = millis();
    if (currentMillis - previousMillis > 1000)
    {
        previousMillis = currentMillis;
        setLightRingStatus(currentCircle);
    }
}

void btDataHandler()
{
    if (bluetooth.available())
    {
        char received = bluetooth.read();
        btData.concat(received);

        if (received == '\n')
        {
            btData.replace('\n', ' ');
            btData.trim();
            Serial.println(btData); //將從藍牙模組接收到的資料送到伺服器
            btData = "";
        }
    }
}

bool checkPIRsensor()
{
    int pirSensorVal = digitalRead(PIRsensor);
    if (pirSensorVal == HIGH)
    {
        Serial.println("Body Detected");
        bluetooth.print("1");
        tone(Buzzer, 1000);
        return true;
    }

    Serial.println("Body Disappeared");
    bluetooth.print("0");
    return false;
}

bool checkRFID()
{
    if (!mfrc522.PICC_IsNewCardPresent())
        return;
    else if (!mfrc522.PICC_ReadCardSerial())
        return;

    String content = "";
    Serial.print("RFID Card Noumber:");
    for (byte i = 0; i < mfrc522.uid.size; i++)
    {
        Serial.print(mfrc522.uid.uidByte[i] < 0x10 ? " 0" : " ");
        Serial.print(mfrc522.uid.uidByte[i], HEX);
        content.concat(String(mfrc522.uid.uidByte[i] < 0x10 ? " 0" : " "));
        content.concat(String(mfrc522.uid.uidByte[i], HEX));
    }
    Serial.println();

    content.toUpperCase();
    mfrc522.PICC_HaltA(); // 讓卡片進入停止模式

    //A6 27 D8 48 磁扣
    if (content.substring(1) == "A6 27 D8 48")
    {
        Serial.println("RFID Pass:" + content.substring(1));
        stepper.step(STEPS / 4.5);
        delay(2000);
        stepper.step(-STEPS / 4.5);
        return true;
    }
    else
    {
        Serial.println("RFID Error:" + content.substring(1));
        return false;
    }
}

//檢查關閉燈環按鈕是否被按下
bool isButtonPressed()
{
    /*if (digitalRead(BtnStopRing) == HIGH)
    {
        Serial.println("lightRing0");
        currentCircle = 0;
        return true;
    }*/
    return false;
}

//燈環狀態
enum LightRingStatus
{
    CLOSE,
    LOOP,
    THEATER_CHASE,
    THEATER_CHASE_RAINBOW,
    RAINBOW,
    RAINBOW_CYCLE,
    STROBE,
    RUNNING_LIGHTS,
    CYLON_BOUNCE,
    SPARKLE
};

//設定燈環模組狀態
void setLightRingStatus(int status)
{
    byte r = 255, g = 255, b = 255; //燈環特效使用顏色

    switch (status)
    {
    case CLOSE: //關閉circle LED
        circleLED.clear();
        circleLED.show();
        break;
    case LOOP: //漸變循環
        circleLoop();
        break;
    case THEATER_CHASE: //劇院追逐
        theaterChase(circleLED.Color(r, g, b), 50);
        break;
    case THEATER_CHASE_RAINBOW: //劇院追逐-彩虹色
        theaterChaseRainbow(50);
        break;
    case RAINBOW: //彩虹
        rainbow(20);
        break;
    case RAINBOW_CYCLE: //彩虹圓圈
        rainbowCycle(20);
        break;
    case STROBE: //閃光
        strobe(r, g, b, 10, 50, 1000);
        break;
    case RUNNING_LIGHTS: //流光
        runningLights(r, g, b, 80);
        break;
    case CYLON_BOUNCE: //賽隆人
        cylonBounce(r, g, b, 2, 70, 70);
        break;
    case SPARKLE: //發泡
        sparkle(r, g, b, 0);
        break;
    default:
        circleLED.clear();
        circleLED.show();
    }
}

//燈環點亮所有LED 並顯示
void showAll(int r, int g, int b)
{
    for (int i = 0; i < circleLED.numPixels(); i++)
    {
        circleLED.setPixelColor(i, r, g, b);
    }
    circleLED.show(); //顯示
}

//燈環漸變循環特效
void circleLoop()
{
    for (int j = 0; j < 3; j++)
    {
        // Fade IN 漸強
        for (int k = 0; k < 256; k++)
        {
            switch (j)
            {
            case 0:
                showAll(k, 0, 0);
                break;
            case 1:
                showAll(0, k, 0);
                break;
            case 2:
                showAll(0, 0, k);
                break;
            }
            delay(5);

            if (isButtonPressed())
                return; // 若偵測到按鈕按下則停止目前特效
        }

        // Fade OUT 漸弱
        for (int k = 255; k >= 0; k--)
        {
            switch (j)
            {
            case 0:
                showAll(k, 0, 0);
                break;
            case 1:
                showAll(0, k, 0);
                break;
            case 2:
                showAll(0, 0, k);
                break;
            }
            delay(5);

            if (isButtonPressed())
                return; // 若偵測到按鈕按下則停止目前特效
        }

        if (isButtonPressed())
            return; // 若偵測到按鈕按下則停止目前特效
    }
}

//燈環劇院追逐特效
void theaterChase(uint32_t c, uint8_t wait)
{
    for (int j = 0; j < 10; j++)
    {
        for (int q = 0; q < 3; q++)
        {
            for (int i = 0; i < circleLED.numPixels(); i = i + 3)
            {
                circleLED.setPixelColor(i + q, c);
            }

            circleLED.show();
            delay(wait);

            for (int i = 0; i < circleLED.numPixels(); i = i + 3)
            {
                circleLED.setPixelColor(i + q, 0);
            }
        }
    }

    if (isButtonPressed())
        return; // 若偵測到按鈕按下則停止目前特效
}

//燈環劇院追逐-彩虹色 特效
void theaterChaseRainbow(uint8_t wait)
{
    for (int j = 0; j < 256; j++)
    {
        for (int q = 0; q < 3; q++)
        {
            for (int i = 0; i < circleLED.numPixels(); i = i + 3)
            {
                circleLED.setPixelColor(i + q, Wheel((i + j) % 255));
            }

            circleLED.show();
            delay(wait);

            for (int i = 0; i < circleLED.numPixels(); i = i + 3)
            {
                circleLED.setPixelColor(i + q, 0);
            }

            if (isButtonPressed())
                return; // 若偵測到按鈕按下則停止目前特效
        }
    }

    if (isButtonPressed())
        return; // 若偵測到按鈕按下則停止目前特效
}

//燈環彩虹特效
void rainbow(uint8_t wait)
{
    for (int j = 0; j < 256; j++)
    {
        for (int i = 0; i < circleLED.numPixels(); i++)
        {
            circleLED.setPixelColor(i, Wheel((i + j) & 255));
        }

        circleLED.show();
        delay(wait);

        if (isButtonPressed())
            return; // 若偵測到按鈕按下則停止目前特效
    }

    if (isButtonPressed())
        return; // 若偵測到按鈕按下則停止目前特效
}

//燈環彩虹圓圈特效
void rainbowCycle(uint8_t wait)
{
    for (int j = 0; j < 256 * 5; j++)
    {
        for (int i = 0; i < circleLED.numPixels(); i++)
        {
            circleLED.setPixelColor(i, Wheel(((i * 256 / circleLED.numPixels()) + j) & 255));
        }

        circleLED.show();
        delay(wait);

        if (isButtonPressed())
            return; // 若偵測到按鈕按下則停止目前特效
    }

    if (isButtonPressed())
        return; // 若偵測到按鈕按下則停止目前特效
}

//燈環閃光特效
void strobe(byte red, byte green, byte blue,
            int strobeCount, int flashDelay, int endPause)
{
    for (int j = 0; j < strobeCount; j++)
    {
        showAll(red, green, blue);
        delay(flashDelay);
        showAll(0, 0, 0);
        delay(flashDelay);
    }
    delay(endPause);

    if (isButtonPressed())
        return; // 若偵測到按鈕按下則停止目前特效
}

//燈環流光特效
void runningLights(byte red, byte green, byte blue, int waveDelay)
{
    int pos = 0;
    for (int i = 0; i < circleLED.numPixels() * 2; i++)
    {
        pos++;
        for (int i = 0; i < circleLED.numPixels(); i++)
        {
            circleLED.setPixelColor(i, ((sin(i + pos) * 127 + 128) / 255) * red,
                                    ((sin(i + pos) * 127 + 128) / 255) * green,
                                    ((sin(i + pos) * 127 + 128) / 255) * blue);
        }

        circleLED.show();
        delay(waveDelay);

        if (isButtonPressed())
            return; // 若偵測到按鈕按下則停止目前特效
    }
}

//燈環賽隆人特效
void cylonBounce(byte red, byte green, byte blue,
                 int eyeSize, int speedDelay, int ReturnDelay)
{
    for (int i = 0; i < circleLED.numPixels() - eyeSize - 2; i++)
    {
        showAll(0, 0, 0);
        circleLED.setPixelColor(i, red / 10, green / 10, blue / 10);
        for (int j = 1; j <= eyeSize; j++)
        {
            circleLED.setPixelColor(i + j, red, green, blue);
        }
        circleLED.setPixelColor(i + eyeSize + 1, red / 10, green / 10, blue / 10);
        circleLED.show();
        delay(speedDelay);
    }
    delay(ReturnDelay);

    for (int i = circleLED.numPixels() - eyeSize - 2; i > 0; i--)
    {
        showAll(0, 0, 0);
        for (int j = 1; j <= eyeSize; j++)
        {
            circleLED.setPixelColor(i + j, red, green, blue);
        }
        circleLED.setPixelColor(i + eyeSize + 1, red / 10, green / 10, blue / 10);
        circleLED.show();
        delay(speedDelay);
    }
    delay(ReturnDelay);

    if (isButtonPressed())
        return; // 若偵測到按鈕按下則停止目前特效
}

//燈環發泡特效
void sparkle(byte red, byte green, byte blue, int speedDelay)
{
    int px = random(circleLED.numPixels());
    circleLED.setPixelColor(px, red, green, blue);
    circleLED.show();
    delay(speedDelay);
    circleLED.setPixelColor(px, 0, 0, 0);
    circleLED.show();

    if (isButtonPressed())
        return; // 若偵測到按鈕按下則停止目前特效
}

//燈環有關彩虹的特效中，產生漸變顏色值的函式
uint32_t Wheel(byte wheelPos)
{
    wheelPos = 255 - wheelPos;
    if (wheelPos < 85)
    {
        return circleLED.Color(255 - wheelPos * 3, 0, wheelPos * 3);
    }
    if (wheelPos < 170)
    {
        wheelPos -= 85;
        return circleLED.Color(0, wheelPos * 3, 255 - wheelPos * 3);
    }
    wheelPos -= 170;
    return circleLED.Color(wheelPos * 3, 255 - wheelPos * 3, 0);
}

//設定燈條模組狀態
void enableLightBar()
{
    int r = random(64, 255);
    int g = random(64, 255);
    int b = random(64, 255);
    meteorLamp(r, g, b, 8, 35); //顯示白色長度8的流星 移動間隔35ms
    delay(500);
}

//燈條迴圈1
void meteorLamp(int r, int g, int b, int len, int delayMs)
{
    for (int i = (0 - len); i <= (int)barLED.numPixels(); i++)
    {
        meteor(r, g, b, i, len); //顯示靜態的流星
        delay(delayMs);          //暫停指定的毫秒
    }
}

//燈條迴圈2
void meteor(int r, int g, int b, int pos, int len)
{
    int n = 255 / ((1 + len) * len / 2);      //算出梯形的 n
    int bright = 255 % ((1 + len) * len / 2); //算出餘數做為初始亮度
    int cnt = 1;                              //計數(由第 1*n 開始計算增量)

    barLED.clear(); //先清為全暗
    for (int i = pos; i < pos + len; i++)
    {                      //由最暗到最亮
        bright += cnt * n; //計算新亮度(=原亮度+增量)
        cnt++;             //將計數加 1
        if (i >= 0 && i < (int)barLED.numPixels())
        { //位置在燈條的範圍內才點亮
            // 點亮目前位置的 LED
            barLED.setPixelColor(i,
                                 map(bright, 0, 255, 0, r),  //利用map做紅色的範圍對映
                                 map(bright, 0, 255, 0, g),  //利用map做綠色的範圍對映
                                 map(bright, 0, 255, 0, b)); //利用map做藍色的範圍對映
        }
    }
    barLED.show(); //將設定實際顯示出來
}

void getTempHumid()
{
    float temp = dht.readTemperature(); //獲取溫度
    float humid = dht.readHumidity();   //獲取濕度

    if (isnan(temp) || isnan(humid))
    {
        Serial.print("getTempHumidError");
        return;
    }

    Serial.print("tempHumid:");
    Serial.print(temp);
    Serial.print(",");
    Serial.println(humid);
}

void respondTempHumidData()
{
    float temp = dht.readTemperature(); //獲取溫度
    float humid = dht.readHumidity();   //獲取濕度

    if (isnan(temp) || isnan(humid))
    {
        Serial.print("getTempHumidError");
        return;
    }

    Serial.print("respondTempHumidData:");
    Serial.print(temp);
    Serial.print(",");
    Serial.println(humid);
}

char lastChar(String str)
{
    return str.charAt(str.length() - 1);
}