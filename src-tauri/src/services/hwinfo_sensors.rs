use std::sync::{Arc, RwLock};

use serde::Serialize;

use crate::models::{GpuStats, SystemStats, SystemStatsPayload};

#[derive(Debug, Clone, PartialEq)]
pub struct CpuSensorSnapshot {
    pub package_temperature: Option<f32>,
    pub package_power: Option<f32>,
    pub core_temperatures: Vec<f32>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct GpuSensorSnapshot {
    pub temperature: Option<f32>,
    pub hotspot_temperature: Option<f32>,
    pub power: Option<f32>,
    pub fan_speed: Option<f32>,
    pub core_clock: Option<u64>,
    pub memory_clock: Option<u64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct HwinfoSensorSnapshot {
    pub cpu: Option<CpuSensorSnapshot>,
    pub gpu: Option<GpuSensorSnapshot>,
}

impl HwinfoSensorSnapshot {
    fn has_supported_reading(&self) -> bool {
        self.cpu.is_some() || self.gpu.is_some()
    }
}

#[derive(Debug, Clone, PartialEq)]
enum HwinfoSensorStatus {
    NotStarted,
    Running,
    ProviderUnavailable(String),
    Error(String),
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum HwinfoSensorStatusInfo {
    NotStarted,
    Running,
    ProviderUnavailable { message: String },
    Error { message: String },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HwinfoReadingType {
    None = 0,
    Temperature = 1,
    Voltage = 2,
    Fan = 3,
    Current = 4,
    Power = 5,
    Clock = 6,
    Usage = 7,
    Other = 8,
}

#[derive(Debug, Clone, PartialEq)]
pub struct HwinfoSensorRecord {
    pub index: u32,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct HwinfoReadingRecord {
    pub sensor_index: u32,
    pub reading_type: HwinfoReadingType,
    pub label: String,
    pub unit: String,
    pub value: f64,
}

pub struct HwinfoSensorMonitor {
    latest: RwLock<Option<HwinfoSensorSnapshot>>,
    status: RwLock<HwinfoSensorStatus>,
}

pub fn apply_snapshot_to_payload(
    payload: &mut SystemStatsPayload,
    snapshot: &HwinfoSensorSnapshot,
) {
    apply_cpu_snapshot(&mut payload.cpu, snapshot.cpu.as_ref());
    apply_gpu_snapshot(payload.gpu.as_mut(), snapshot.gpu.as_ref());
}

pub fn apply_snapshot_to_system_stats(stats: &mut SystemStats, snapshot: &HwinfoSensorSnapshot) {
    apply_cpu_snapshot(&mut stats.cpu, snapshot.cpu.as_ref());
    apply_gpu_snapshot(stats.gpu.as_mut(), snapshot.gpu.as_ref());
}

fn apply_cpu_snapshot(cpu: &mut crate::models::CpuStats, snapshot: Option<&CpuSensorSnapshot>) {
    let Some(snapshot) = snapshot else {
        return;
    };

    if let Some(package_temperature) = snapshot.package_temperature {
        cpu.temperature = Some(package_temperature);
    }
    if !snapshot.core_temperatures.is_empty() {
        cpu.core_temperatures = Some(snapshot.core_temperatures.clone());
    }
    if let Some(package_power) = snapshot.package_power {
        cpu.power = Some(package_power);
    }
}

fn apply_gpu_snapshot(gpu: Option<&mut GpuStats>, snapshot: Option<&GpuSensorSnapshot>) {
    let (Some(gpu), Some(snapshot)) = (gpu, snapshot) else {
        return;
    };

    if gpu.temperature.is_none() {
        gpu.temperature = snapshot.temperature;
    }
    if gpu.hot_spot_temperature.is_none() {
        gpu.hot_spot_temperature = snapshot.hotspot_temperature;
    }
    if gpu.power.is_none() {
        gpu.power = snapshot.power;
    }
    if gpu.core_clock.is_none() {
        gpu.core_clock = snapshot.core_clock.map(|clock| clock as f32);
    }
    if gpu.memory_clock.is_none() {
        gpu.memory_clock = snapshot.memory_clock.map(|clock| clock as f32);
    }
    if gpu.fan_speed.is_none() {
        gpu.fan_speed = snapshot.fan_speed;
    }
}

impl HwinfoSensorMonitor {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            latest: RwLock::new(None),
            status: RwLock::new(HwinfoSensorStatus::NotStarted),
        })
    }

    pub fn poll(&self) {
        match read_hwinfo_sensor_snapshot() {
            Ok(snapshot) if snapshot.has_supported_reading() => self.set_running(snapshot),
            Ok(_) => self.set_error(HwinfoSensorError::NoSupportedSensors.to_string()),
            Err(error) if error.is_provider_unavailable() => {
                self.set_unavailable(error.to_string())
            }
            Err(error) => self.set_error(error.to_string()),
        }
    }

    pub fn latest_snapshot(&self) -> Option<HwinfoSensorSnapshot> {
        self.latest
            .read()
            .ok()
            .and_then(|snapshot| snapshot.clone())
    }

    pub fn status_info(&self) -> HwinfoSensorStatusInfo {
        match self
            .status
            .read()
            .ok()
            .map(|status| status.clone())
            .unwrap_or(HwinfoSensorStatus::NotStarted)
        {
            HwinfoSensorStatus::NotStarted => HwinfoSensorStatusInfo::NotStarted,
            HwinfoSensorStatus::Running => HwinfoSensorStatusInfo::Running,
            HwinfoSensorStatus::ProviderUnavailable(message) => {
                HwinfoSensorStatusInfo::ProviderUnavailable { message }
            }
            HwinfoSensorStatus::Error(message) => HwinfoSensorStatusInfo::Error { message },
        }
    }

    fn set_running(&self, snapshot: HwinfoSensorSnapshot) {
        if let Ok(mut latest) = self.latest.write() {
            *latest = Some(snapshot);
        }
        if let Ok(mut status) = self.status.write() {
            *status = HwinfoSensorStatus::Running;
        }
    }

    fn set_unavailable(&self, message: String) {
        self.clear_latest();
        if let Ok(mut status) = self.status.write() {
            *status = HwinfoSensorStatus::ProviderUnavailable(message);
        }
    }

    fn set_error(&self, message: String) {
        self.clear_latest();
        if let Ok(mut status) = self.status.write() {
            *status = HwinfoSensorStatus::Error(message);
        }
    }

    fn clear_latest(&self) {
        if let Ok(mut latest) = self.latest.write() {
            *latest = None;
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum HwinfoSensorError {
    ProviderUnavailable(String),
    NoSupportedSensors,
    ReadFailed(String),
}

impl HwinfoSensorError {
    fn is_provider_unavailable(&self) -> bool {
        matches!(self, Self::ProviderUnavailable(_))
    }
}

impl std::fmt::Display for HwinfoSensorError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ProviderUnavailable(message) => formatter.write_str(message),
            Self::NoSupportedSensors => formatter.write_str(
                "HWiNFO is running, but Pulse could not find supported CPU or GPU sensor readings.",
            ),
            Self::ReadFailed(message) => {
                write!(formatter, "Failed to read HWiNFO sensors: {message}")
            }
        }
    }
}

pub fn select_hwinfo_sensor_snapshot(
    sensors: &[HwinfoSensorRecord],
    readings: &[HwinfoReadingRecord],
) -> Result<HwinfoSensorSnapshot, HwinfoSensorError> {
    let cpu = select_cpu_sensor_snapshot(sensors, readings);
    let gpu = select_gpu_sensor_snapshot(sensors, readings);
    let snapshot = HwinfoSensorSnapshot { cpu, gpu };

    if snapshot.has_supported_reading() {
        Ok(snapshot)
    } else {
        Err(HwinfoSensorError::NoSupportedSensors)
    }
}

fn select_cpu_sensor_snapshot(
    sensors: &[HwinfoSensorRecord],
    readings: &[HwinfoReadingRecord],
) -> Option<CpuSensorSnapshot> {
    let mut package_temperature = None;
    let mut package_power = None;
    let mut core_temperatures = Vec::new();

    for reading in readings {
        let Some(sensor) = sensors
            .iter()
            .find(|sensor| sensor.index == reading.sensor_index)
        else {
            continue;
        };
        if !is_cpu_sensor(&sensor.name) {
            continue;
        }

        let label = reading.label.to_ascii_lowercase();
        let value = reading.value as f32;

        match reading.reading_type {
            HwinfoReadingType::Temperature if is_celsius_unit(&reading.unit) => {
                if is_package_label(&label) {
                    package_temperature = Some(value);
                } else if is_core_label(&label) {
                    core_temperatures.push(value);
                }
            }
            HwinfoReadingType::Power if is_watt_unit(&reading.unit) => {
                if is_cpu_package_power_label(&label) {
                    package_power = Some(value);
                }
            }
            _ => {}
        }
    }

    let package_temperature =
        package_temperature.or_else(|| core_temperatures.iter().copied().reduce(f32::max));

    if package_temperature.is_none() && package_power.is_none() && core_temperatures.is_empty() {
        return None;
    }

    Some(CpuSensorSnapshot {
        package_temperature,
        package_power,
        core_temperatures,
    })
}

fn select_gpu_sensor_snapshot(
    sensors: &[HwinfoSensorRecord],
    readings: &[HwinfoReadingRecord],
) -> Option<GpuSensorSnapshot> {
    let mut snapshot = GpuSensorSnapshot::default();

    for reading in readings {
        let Some(sensor) = sensors
            .iter()
            .find(|sensor| sensor.index == reading.sensor_index)
        else {
            continue;
        };
        if !is_gpu_sensor(&sensor.name) {
            continue;
        }

        let label = reading.label.to_ascii_lowercase();
        let value = reading.value as f32;

        match reading.reading_type {
            HwinfoReadingType::Temperature if is_celsius_unit(&reading.unit) => {
                if is_gpu_hotspot_label(&label) {
                    snapshot.hotspot_temperature = Some(value);
                } else if is_gpu_temperature_label(&label) {
                    snapshot.temperature = Some(value);
                }
            }
            HwinfoReadingType::Power
                if is_watt_unit(&reading.unit) && is_gpu_power_label(&label) =>
            {
                snapshot.power = Some(value);
            }
            HwinfoReadingType::Clock if is_megahertz_unit(&reading.unit) => {
                if is_gpu_memory_clock_label(&label) {
                    snapshot.memory_clock = rounded_positive_u64(reading.value);
                } else if is_gpu_core_clock_label(&label) {
                    snapshot.core_clock = rounded_positive_u64(reading.value);
                }
            }
            HwinfoReadingType::Fan if is_percent_unit(&reading.unit) && label.contains("fan") => {
                snapshot.fan_speed = Some(value);
            }
            _ => {}
        }
    }

    if snapshot.temperature.is_some()
        || snapshot.hotspot_temperature.is_some()
        || snapshot.power.is_some()
        || snapshot.fan_speed.is_some()
        || snapshot.core_clock.is_some()
        || snapshot.memory_clock.is_some()
    {
        Some(snapshot)
    } else {
        None
    }
}

fn is_cpu_sensor(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    (name.contains("cpu") || name.contains("processor")) && !name.contains("gpu")
}

fn is_gpu_sensor(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    !name.contains("cpu")
        && (name.contains("gpu")
            || name.contains("nvidia")
            || name.contains("radeon")
            || name.contains("geforce")
            || name.contains("rtx")
            || name.contains("gtx")
            || name.contains("intel arc"))
}

fn is_celsius_unit(unit: &str) -> bool {
    let unit = unit.trim().to_ascii_lowercase();
    unit == "c"
        || unit == "°c"
        || unit == "degc"
        || (unit.ends_with('c') && unit.chars().count() <= 2)
}

fn is_watt_unit(unit: &str) -> bool {
    let unit = unit.trim().to_ascii_lowercase();
    unit == "w" || unit == "watt" || unit == "watts"
}

fn is_megahertz_unit(unit: &str) -> bool {
    unit.trim().eq_ignore_ascii_case("mhz")
}

fn is_percent_unit(unit: &str) -> bool {
    let unit = unit.trim();
    unit == "%" || unit.eq_ignore_ascii_case("percent")
}

fn is_package_label(label: &str) -> bool {
    label.contains("cpu package")
        || label.contains("package")
        || label.contains("tctl/tdie")
        || label.contains("cpu die")
}

fn is_cpu_package_power_label(label: &str) -> bool {
    const EXCLUDED_CPU_POWER_LABEL_TERMS: [&str; 5] = [
        "ia cores",
        "gt cores",
        "uncore",
        "core power",
        "cores power",
    ];

    !EXCLUDED_CPU_POWER_LABEL_TERMS
        .iter()
        .any(|term| label.contains(term))
        && (label.contains("cpu package power")
            || label.contains("package power")
            || label.contains("cpu total power")
            || label.contains("total cpu power"))
}

fn is_gpu_temperature_label(label: &str) -> bool {
    label.contains("gpu temperature") || label == "temperature"
}

fn is_gpu_hotspot_label(label: &str) -> bool {
    label.contains("hot spot") || label.contains("hotspot")
}

fn is_gpu_power_label(label: &str) -> bool {
    label.contains("gpu power") || label.contains("board power") || label == "power"
}

fn is_gpu_core_clock_label(label: &str) -> bool {
    (label.contains("gpu") || label.contains("core") || label == "clock")
        && !label.contains("memory")
}

fn is_gpu_memory_clock_label(label: &str) -> bool {
    label.contains("memory") && label.contains("clock")
}

fn rounded_positive_u64(value: f64) -> Option<u64> {
    if value.is_finite() && value > 0.0 {
        Some(value.round() as u64)
    } else {
        None
    }
}

fn is_core_label(label: &str) -> bool {
    const EXCLUDED_CORE_LABEL_TERMS: [&str; 15] = [
        "average", "avg", "max", "distance", "tjmax", "limit", "thermal", "ia cores", "gt cores",
        "uncore", "cache", "graphics", "vid", "voltage", "power",
    ];

    if EXCLUDED_CORE_LABEL_TERMS
        .iter()
        .any(|term| label.contains(term))
        || label.contains("clock")
    {
        return false;
    }

    label.match_indices("core").any(|(index, _)| {
        let suffix = &label[index + "core".len()..];
        let next = suffix
            .chars()
            .find(|character| !is_core_number_separator(*character));
        matches!(next, Some(character) if character.is_ascii_digit())
    })
}

fn is_core_number_separator(character: char) -> bool {
    character.is_ascii_whitespace() || matches!(character, '#' | ':' | '-' | '_' | '[' | '(')
}

#[cfg(windows)]
#[allow(non_upper_case_globals)]
const HWiNFO_SENSORS_MAP_FILE_NAME: &str = "Global\\HWiNFO_SENS_SM2";
#[cfg(windows)]
#[allow(non_upper_case_globals)]
const HWiNFO_SENSORS_MUTEX_NAME: &str = "Global\\HWiNFO_SM2_MUTEX";
#[cfg(windows)]
#[allow(non_upper_case_globals)]
const HWiNFO_SIGNATURE_ACTIVE: u32 = u32::from_le_bytes(*b"HWiS");
#[cfg(windows)]
#[allow(non_upper_case_globals)]
const HWiNFO_HEADER_MIN_SIZE: usize = 44;
#[cfg(windows)]
#[allow(non_upper_case_globals)]
const HWiNFO_SENSORS_STRING_LEN: usize = 128;
#[cfg(windows)]
#[allow(non_upper_case_globals)]
const HWiNFO_UNIT_STRING_LEN: usize = 16;

#[cfg(windows)]
#[allow(dead_code)]
struct HwinfoSharedMemHeader {
    signature: u32,
    version: u32,
    revision: u32,
    poll_time: i64,
    sensor_section_offset: u32,
    sensor_element_size: u32,
    sensor_count: u32,
    reading_section_offset: u32,
    reading_element_size: u32,
    reading_count: u32,
}

#[cfg(windows)]
#[repr(C, packed)]
#[derive(Clone, Copy)]
struct HwinfoSensorElement {
    sensor_id: u32,
    sensor_instance: u32,
    sensor_name_orig: [u8; HWiNFO_SENSORS_STRING_LEN],
    sensor_name_user: [u8; HWiNFO_SENSORS_STRING_LEN],
}

#[cfg(windows)]
#[repr(C, packed)]
#[derive(Clone, Copy)]
struct HwinfoReadingElement {
    reading_type: u32,
    sensor_index: u32,
    reading_id: u32,
    label_orig: [u8; HWiNFO_SENSORS_STRING_LEN],
    label_user: [u8; HWiNFO_SENSORS_STRING_LEN],
    unit: [u8; HWiNFO_UNIT_STRING_LEN],
    value: f64,
    value_min: f64,
    value_max: f64,
    value_avg: f64,
}

#[cfg(windows)]
fn zero_terminated_string(bytes: &[u8]) -> String {
    let end = bytes
        .iter()
        .position(|byte| *byte == 0)
        .unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..end]).trim().to_string()
}

#[cfg(windows)]
fn reading_type_from_u32(value: u32) -> HwinfoReadingType {
    match value {
        1 => HwinfoReadingType::Temperature,
        2 => HwinfoReadingType::Voltage,
        3 => HwinfoReadingType::Fan,
        4 => HwinfoReadingType::Current,
        5 => HwinfoReadingType::Power,
        6 => HwinfoReadingType::Clock,
        7 => HwinfoReadingType::Usage,
        8 => HwinfoReadingType::Other,
        _ => HwinfoReadingType::None,
    }
}

#[cfg(windows)]
fn wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(windows)]
unsafe fn read_u32_at(
    base: *const u8,
    mapped_len: usize,
    offset: usize,
) -> Result<u32, HwinfoSensorError> {
    match offset.checked_add(std::mem::size_of::<u32>()) {
        Some(end) if end <= mapped_len => {}
        _ => {
            return Err(HwinfoSensorError::ReadFailed(
                "HWiNFO shared memory header is truncated.".to_string(),
            ));
        }
    }
    Ok(std::ptr::read_unaligned(base.add(offset) as *const u32))
}

#[cfg(windows)]
unsafe fn read_i64_at(
    base: *const u8,
    mapped_len: usize,
    offset: usize,
) -> Result<i64, HwinfoSensorError> {
    match offset.checked_add(std::mem::size_of::<i64>()) {
        Some(end) if end <= mapped_len => {}
        _ => {
            return Err(HwinfoSensorError::ReadFailed(
                "HWiNFO shared memory header is truncated.".to_string(),
            ));
        }
    }
    Ok(std::ptr::read_unaligned(base.add(offset) as *const i64))
}

#[cfg(windows)]
unsafe fn read_header(
    base: *const u8,
    mapped_len: usize,
) -> Result<HwinfoSharedMemHeader, HwinfoSensorError> {
    if mapped_len < HWiNFO_HEADER_MIN_SIZE {
        return Err(HwinfoSensorError::ReadFailed(
            "HWiNFO shared memory header is too small.".to_string(),
        ));
    }

    Ok(HwinfoSharedMemHeader {
        signature: read_u32_at(base, mapped_len, 0)?,
        version: read_u32_at(base, mapped_len, 4)?,
        revision: read_u32_at(base, mapped_len, 8)?,
        poll_time: read_i64_at(base, mapped_len, 12)?,
        sensor_section_offset: read_u32_at(base, mapped_len, 20)?,
        sensor_element_size: read_u32_at(base, mapped_len, 24)?,
        sensor_count: read_u32_at(base, mapped_len, 28)?,
        reading_section_offset: read_u32_at(base, mapped_len, 32)?,
        reading_element_size: read_u32_at(base, mapped_len, 36)?,
        reading_count: read_u32_at(base, mapped_len, 40)?,
    })
}

#[cfg(windows)]
fn checked_section_layout(
    offset: u32,
    element_size: u32,
    count: u32,
    min_element_size: usize,
    section_name: &str,
) -> Result<(usize, usize, usize), HwinfoSensorError> {
    let offset = offset as usize;
    let element_size = element_size as usize;
    let count = count as usize;

    if element_size < min_element_size {
        return Err(HwinfoSensorError::ReadFailed(format!(
            "HWiNFO {section_name} element layout is older than Pulse supports."
        )));
    }

    let byte_len = element_size.checked_mul(count).ok_or_else(|| {
        HwinfoSensorError::ReadFailed(format!("HWiNFO {section_name} section is too large."))
    })?;
    let end = offset.checked_add(byte_len).ok_or_else(|| {
        HwinfoSensorError::ReadFailed(format!("HWiNFO {section_name} section offset overflowed."))
    })?;

    Ok((offset, element_size, end))
}

#[cfg(windows)]
fn read_hwinfo_sensor_snapshot() -> Result<HwinfoSensorSnapshot, HwinfoSensorError> {
    read_hwinfo_shared_memory()
}

#[cfg(windows)]
fn read_hwinfo_shared_memory() -> Result<HwinfoSensorSnapshot, HwinfoSensorError> {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{CloseHandle, WAIT_ABANDONED, WAIT_OBJECT_0};
    use windows::Win32::System::Memory::{
        MapViewOfFile, OpenFileMappingW, UnmapViewOfFile, FILE_MAP_READ,
    };
    use windows::Win32::System::Threading::{
        OpenMutexW, ReleaseMutex, WaitForSingleObject, MUTEX_MODIFY_STATE,
        SYNCHRONIZATION_SYNCHRONIZE,
    };

    unsafe {
        let mapping_name = wide_null(HWiNFO_SENSORS_MAP_FILE_NAME);
        let mutex_name = wide_null(HWiNFO_SENSORS_MUTEX_NAME);

        let mapping = OpenFileMappingW(FILE_MAP_READ.0, false, PCWSTR(mapping_name.as_ptr()))
            .map_err(|_| {
                HwinfoSensorError::ProviderUnavailable(
                    "HWiNFO sensors require HWiNFO64 running in Sensor mode with Shared Memory Support enabled.".to_string(),
                )
            })?;

        let mutex = OpenMutexW(
            SYNCHRONIZATION_SYNCHRONIZE | MUTEX_MODIFY_STATE,
            false,
            PCWSTR(mutex_name.as_ptr()),
        )
        .ok();

        if let Some(mutex) = mutex {
            let wait_result = WaitForSingleObject(mutex, 1_000);
            if wait_result != WAIT_OBJECT_0 && wait_result != WAIT_ABANDONED {
                let _ = CloseHandle(mapping);
                let _ = CloseHandle(mutex);
                return Err(HwinfoSensorError::ReadFailed(
                    "Timed out waiting for the HWiNFO shared-memory mutex.".to_string(),
                ));
            }
        }

        let header_view = MapViewOfFile(mapping, FILE_MAP_READ, 0, 0, HWiNFO_HEADER_MIN_SIZE);
        if header_view.Value.is_null() {
            if let Some(mutex) = mutex {
                let _ = ReleaseMutex(mutex);
                let _ = CloseHandle(mutex);
            }
            let _ = CloseHandle(mapping);
            return Err(HwinfoSensorError::ReadFailed(
                "HWiNFO shared memory could not be mapped.".to_string(),
            ));
        }

        let header_result = read_header(header_view.Value as *const u8, HWiNFO_HEADER_MIN_SIZE);
        let _ = UnmapViewOfFile(header_view);
        let header = match header_result {
            Ok(header) => header,
            Err(error) => {
                if let Some(mutex) = mutex {
                    let _ = ReleaseMutex(mutex);
                    let _ = CloseHandle(mutex);
                }
                let _ = CloseHandle(mapping);
                return Err(error);
            }
        };

        if header.signature != HWiNFO_SIGNATURE_ACTIVE {
            if let Some(mutex) = mutex {
                let _ = ReleaseMutex(mutex);
                let _ = CloseHandle(mutex);
            }
            let _ = CloseHandle(mapping);
            return Err(HwinfoSensorError::ProviderUnavailable(
                "HWiNFO shared memory is present but not active.".to_string(),
            ));
        }

        if header.sensor_count > 512 || header.reading_count > 4096 {
            if let Some(mutex) = mutex {
                let _ = ReleaseMutex(mutex);
                let _ = CloseHandle(mutex);
            }
            let _ = CloseHandle(mapping);
            return Err(HwinfoSensorError::ReadFailed(
                "HWiNFO shared memory reported an unexpected sensor count.".to_string(),
            ));
        }

        let layout_result = (|| {
            let sensor = checked_section_layout(
                header.sensor_section_offset,
                header.sensor_element_size,
                header.sensor_count,
                std::mem::size_of::<HwinfoSensorElement>(),
                "sensor",
            )?;
            let reading = checked_section_layout(
                header.reading_section_offset,
                header.reading_element_size,
                header.reading_count,
                std::mem::size_of::<HwinfoReadingElement>(),
                "reading",
            )?;
            Ok::<_, HwinfoSensorError>((sensor, reading))
        })();
        let ((sensor_offset, sensor_size, sensor_end), (reading_offset, reading_size, reading_end)) =
            match layout_result {
                Ok(layout) => layout,
                Err(error) => {
                    if let Some(mutex) = mutex {
                        let _ = ReleaseMutex(mutex);
                        let _ = CloseHandle(mutex);
                    }
                    let _ = CloseHandle(mapping);
                    return Err(error);
                }
            };

        let mapped_len = sensor_end.max(reading_end).max(HWiNFO_HEADER_MIN_SIZE);
        let view = MapViewOfFile(mapping, FILE_MAP_READ, 0, 0, mapped_len);
        if view.Value.is_null() {
            if let Some(mutex) = mutex {
                let _ = ReleaseMutex(mutex);
                let _ = CloseHandle(mutex);
            }
            let _ = CloseHandle(mapping);
            return Err(HwinfoSensorError::ReadFailed(
                "HWiNFO shared memory sections could not be mapped.".to_string(),
            ));
        }

        let result = parse_hwinfo_view(
            view.Value as *const u8,
            mapped_len,
            header,
            sensor_offset,
            sensor_size,
            reading_offset,
            reading_size,
        );

        let _ = UnmapViewOfFile(view);
        if let Some(mutex) = mutex {
            let _ = ReleaseMutex(mutex);
            let _ = CloseHandle(mutex);
        }
        let _ = CloseHandle(mapping);

        result
    }
}

#[cfg(windows)]
unsafe fn parse_hwinfo_view(
    base: *const u8,
    mapped_len: usize,
    header: HwinfoSharedMemHeader,
    sensor_offset: usize,
    sensor_size: usize,
    reading_offset: usize,
    reading_size: usize,
) -> Result<HwinfoSensorSnapshot, HwinfoSensorError> {
    let mut sensors = Vec::with_capacity(header.sensor_count as usize);
    for index in 0..header.sensor_count {
        let element_offset = sensor_offset + index as usize * sensor_size;
        if element_offset + std::mem::size_of::<HwinfoSensorElement>() > mapped_len {
            return Err(HwinfoSensorError::ReadFailed(
                "HWiNFO sensor element extends past mapped memory.".to_string(),
            ));
        }
        let ptr = base.add(element_offset);
        let sensor = std::ptr::read_unaligned(ptr as *const HwinfoSensorElement);
        let name_bytes = sensor.sensor_name_orig;
        sensors.push(HwinfoSensorRecord {
            index,
            name: zero_terminated_string(&name_bytes),
        });
    }

    let mut readings = Vec::with_capacity(header.reading_count as usize);
    for index in 0..header.reading_count {
        let element_offset = reading_offset + index as usize * reading_size;
        if element_offset + std::mem::size_of::<HwinfoReadingElement>() > mapped_len {
            return Err(HwinfoSensorError::ReadFailed(
                "HWiNFO reading element extends past mapped memory.".to_string(),
            ));
        }
        let ptr = base.add(element_offset);
        let reading = std::ptr::read_unaligned(ptr as *const HwinfoReadingElement);
        let label_bytes = reading.label_orig;
        let unit_bytes = reading.unit;
        let sensor_index = reading.sensor_index;
        let reading_type = reading.reading_type;
        let value = reading.value;
        readings.push(HwinfoReadingRecord {
            sensor_index,
            reading_type: reading_type_from_u32(reading_type),
            label: zero_terminated_string(&label_bytes),
            unit: zero_terminated_string(&unit_bytes),
            value,
        });
    }

    select_hwinfo_sensor_snapshot(&sensors, &readings)
}

#[cfg(not(windows))]
fn read_hwinfo_sensor_snapshot() -> Result<HwinfoSensorSnapshot, HwinfoSensorError> {
    Err(HwinfoSensorError::ProviderUnavailable(
        "HWiNFO sensors require HWiNFO64 on Windows.".to_string(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{GpuStats, SystemStats, SystemStatsPayload};

    #[test]
    fn apply_snapshot_to_payload_sets_cpu_temperature_core_temps_and_power() {
        let snapshot = HwinfoSensorSnapshot {
            cpu: Some(CpuSensorSnapshot {
                package_temperature: Some(72.0),
                package_power: Some(42.5),
                core_temperatures: vec![61.0, 62.0],
            }),
            gpu: None,
        };
        let mut payload = SystemStatsPayload::default();

        apply_snapshot_to_payload(&mut payload, &snapshot);

        assert_eq!(payload.cpu.temperature, Some(72.0));
        assert_eq!(payload.cpu.core_temperatures, Some(vec![61.0, 62.0]));
        assert_eq!(payload.cpu.power, Some(42.5));
    }

    #[test]
    fn apply_snapshot_to_system_stats_fills_missing_gpu_metrics_without_overwriting_nvml() {
        let snapshot = HwinfoSensorSnapshot {
            cpu: None,
            gpu: Some(GpuSensorSnapshot {
                temperature: Some(62.0),
                hotspot_temperature: Some(75.0),
                power: Some(88.0),
                fan_speed: Some(45.0),
                core_clock: Some(2100),
                memory_clock: Some(8000),
            }),
        };
        let mut stats = SystemStats::default();
        stats.gpu = Some(GpuStats {
            name: "NVIDIA GeForce RTX".to_string(),
            temperature: Some(55.0),
            fan_speed: Some(30.0),
            memory_clock: Some(7000.0),
            ..GpuStats::default()
        });

        apply_snapshot_to_system_stats(&mut stats, &snapshot);

        let gpu = stats.gpu.unwrap();
        assert_eq!(gpu.temperature, Some(55.0));
        assert_eq!(gpu.fan_speed, Some(30.0));
        assert_eq!(gpu.hot_spot_temperature, Some(75.0));
        assert_eq!(gpu.power, Some(88.0));
        assert_eq!(gpu.core_clock, Some(2100.0));
        assert_eq!(gpu.memory_clock, Some(7000.0));
    }

    #[test]
    fn selects_package_and_core_temperatures_from_cpu_sensor() {
        let sensors = vec![HwinfoSensorRecord {
            index: 0,
            name: "CPU [#0]: AMD Ryzen".to_string(),
        }];
        let readings = vec![
            HwinfoReadingRecord {
                sensor_index: 0,
                reading_type: HwinfoReadingType::Temperature,
                label: "CPU Package".to_string(),
                unit: "°C".to_string(),
                value: 71.5,
            },
            HwinfoReadingRecord {
                sensor_index: 0,
                reading_type: HwinfoReadingType::Temperature,
                label: "Core 0".to_string(),
                unit: "°C".to_string(),
                value: 66.0,
            },
        ];

        let snapshot = select_hwinfo_sensor_snapshot(&sensors, &readings).unwrap();
        let reading = snapshot.cpu.unwrap();

        assert_eq!(reading.package_temperature, Some(71.5));
        assert_eq!(reading.core_temperatures, vec![66.0]);
    }

    #[test]
    fn gpu_temperature_readings_do_not_populate_cpu_snapshot() {
        let sensors = vec![HwinfoSensorRecord {
            index: 0,
            name: "GPU [#0]: NVIDIA".to_string(),
        }];
        let readings = vec![HwinfoReadingRecord {
            sensor_index: 0,
            reading_type: HwinfoReadingType::Temperature,
            label: "GPU Temperature".to_string(),
            unit: "°C".to_string(),
            value: 60.0,
        }];

        let snapshot = select_hwinfo_sensor_snapshot(&sensors, &readings).unwrap();

        assert_eq!(snapshot.cpu, None);
        assert_eq!(snapshot.gpu.unwrap().temperature, Some(60.0));
    }

    #[test]
    fn falls_back_to_hottest_core_when_package_is_missing() {
        let sensors = vec![HwinfoSensorRecord {
            index: 0,
            name: "Processor".to_string(),
        }];
        let readings = vec![
            HwinfoReadingRecord {
                sensor_index: 0,
                reading_type: HwinfoReadingType::Temperature,
                label: "Core 0".to_string(),
                unit: "C".to_string(),
                value: 61.0,
            },
            HwinfoReadingRecord {
                sensor_index: 0,
                reading_type: HwinfoReadingType::Temperature,
                label: "Core 1".to_string(),
                unit: "C".to_string(),
                value: 64.0,
            },
        ];

        let snapshot = select_hwinfo_sensor_snapshot(&sensors, &readings).unwrap();
        let reading = snapshot.cpu.unwrap();

        assert_eq!(reading.package_temperature, Some(64.0));
        assert_eq!(reading.core_temperatures, vec![61.0, 64.0]);
    }

    #[test]
    fn select_hwinfo_snapshot_filters_cpu_core_aggregate_temperature_rows() {
        let sensors = vec![HwinfoSensorRecord {
            index: 0,
            name: "CPU [#0]: Intel Core i5-12450HX".to_string(),
        }];
        let mut readings = vec![HwinfoReadingRecord {
            sensor_index: 0,
            reading_type: HwinfoReadingType::Temperature,
            label: "CPU Package".to_string(),
            unit: "°C".to_string(),
            value: 72.0,
        }];
        readings.extend((0..8).map(|core| HwinfoReadingRecord {
            sensor_index: 0,
            reading_type: HwinfoReadingType::Temperature,
            label: format!("Core {core}"),
            unit: "°C".to_string(),
            value: 61.0 + f64::from(core),
        }));
        readings.extend(
            [
                "Core Max",
                "Core Average",
                "Core Distance to TjMAX",
                "CPU IA Cores",
                "CPU GT Cores",
            ]
            .map(|label| HwinfoReadingRecord {
                sensor_index: 0,
                reading_type: HwinfoReadingType::Temperature,
                label: label.to_string(),
                unit: "°C".to_string(),
                value: 99.0,
            }),
        );

        let snapshot = select_hwinfo_sensor_snapshot(&sensors, &readings).unwrap();
        let reading = snapshot.cpu.unwrap();

        assert_eq!(reading.package_temperature, Some(72.0));
        assert_eq!(
            reading.core_temperatures,
            vec![61.0, 62.0, 63.0, 64.0, 65.0, 66.0, 67.0, 68.0]
        );
    }

    #[test]
    fn select_hwinfo_snapshot_selects_cpu_package_power() {
        let sensors = vec![HwinfoSensorRecord {
            index: 0,
            name: "CPU [#0]: Intel Core i5-12450HX".to_string(),
        }];
        let readings = vec![
            HwinfoReadingRecord {
                sensor_index: 0,
                reading_type: HwinfoReadingType::Power,
                label: "CPU Package Power".to_string(),
                unit: "W".to_string(),
                value: 42.5,
            },
            HwinfoReadingRecord {
                sensor_index: 0,
                reading_type: HwinfoReadingType::Power,
                label: "IA Cores Power".to_string(),
                unit: "W".to_string(),
                value: 99.0,
            },
        ];

        let snapshot = select_hwinfo_sensor_snapshot(&sensors, &readings).unwrap();
        let reading = snapshot.cpu.unwrap();

        assert_eq!(reading.package_power, Some(42.5));
    }

    #[test]
    fn select_hwinfo_snapshot_selects_gpu_advanced_metrics() {
        let sensors = vec![HwinfoSensorRecord {
            index: 0,
            name: "GPU [#0]: NVIDIA GeForce RTX".to_string(),
        }];
        let readings = vec![
            HwinfoReadingRecord {
                sensor_index: 0,
                reading_type: HwinfoReadingType::Temperature,
                label: "GPU Temperature".to_string(),
                unit: "°C".to_string(),
                value: 62.0,
            },
            HwinfoReadingRecord {
                sensor_index: 0,
                reading_type: HwinfoReadingType::Temperature,
                label: "GPU Hot Spot Temperature".to_string(),
                unit: "°C".to_string(),
                value: 75.0,
            },
            HwinfoReadingRecord {
                sensor_index: 0,
                reading_type: HwinfoReadingType::Power,
                label: "GPU Power".to_string(),
                unit: "W".to_string(),
                value: 88.0,
            },
            HwinfoReadingRecord {
                sensor_index: 0,
                reading_type: HwinfoReadingType::Clock,
                label: "GPU Clock".to_string(),
                unit: "MHz".to_string(),
                value: 2100.0,
            },
            HwinfoReadingRecord {
                sensor_index: 0,
                reading_type: HwinfoReadingType::Clock,
                label: "GPU Memory Clock".to_string(),
                unit: "MHz".to_string(),
                value: 8000.0,
            },
            HwinfoReadingRecord {
                sensor_index: 0,
                reading_type: HwinfoReadingType::Fan,
                label: "GPU Fan".to_string(),
                unit: "%".to_string(),
                value: 45.0,
            },
            HwinfoReadingRecord {
                sensor_index: 0,
                reading_type: HwinfoReadingType::Fan,
                label: "GPU Fan".to_string(),
                unit: "RPM".to_string(),
                value: 1_500.0,
            },
        ];

        let snapshot = select_hwinfo_sensor_snapshot(&sensors, &readings).unwrap();
        let gpu = snapshot.gpu.unwrap();

        assert_eq!(gpu.temperature, Some(62.0));
        assert_eq!(gpu.hotspot_temperature, Some(75.0));
        assert_eq!(gpu.power, Some(88.0));
        assert_eq!(gpu.core_clock, Some(2100));
        assert_eq!(gpu.memory_clock, Some(8000));
        assert_eq!(gpu.fan_speed, Some(45.0));
    }

    #[test]
    fn accepts_legacy_ansi_degree_unit_after_lossy_decoding() {
        let sensors = vec![HwinfoSensorRecord {
            index: 0,
            name: "CPU [#0]: AMD Ryzen".to_string(),
        }];
        let readings = vec![HwinfoReadingRecord {
            sensor_index: 0,
            reading_type: HwinfoReadingType::Temperature,
            label: "CPU Package".to_string(),
            unit: "\u{FFFD}C".to_string(),
            value: 70.0,
        }];

        let snapshot = select_hwinfo_sensor_snapshot(&sensors, &readings).unwrap();
        let reading = snapshot.cpu.unwrap();

        assert_eq!(reading.package_temperature, Some(70.0));
    }

    #[test]
    fn serializes_provider_unavailable_status_for_frontend_contract() {
        let status = HwinfoSensorStatusInfo::ProviderUnavailable {
            message: "HWiNFO sensors require HWiNFO64 running in Sensor mode with Shared Memory Support enabled.".to_string(),
        };

        let serialized = serde_json::to_value(status).unwrap();

        assert_eq!(serialized["status"], "provider_unavailable");
        assert_eq!(
            serialized["message"],
            "HWiNFO sensors require HWiNFO64 running in Sensor mode with Shared Memory Support enabled."
        );
    }

    #[cfg(windows)]
    #[test]
    fn trims_zero_terminated_hwinfo_strings() {
        let mut bytes = [0u8; 8];
        bytes[..3].copy_from_slice(b"CPU");

        assert_eq!(zero_terminated_string(&bytes), "CPU");
    }

    #[cfg(windows)]
    #[test]
    fn parses_hwinfo_view_with_descriptor_stride_padding() {
        let sensor_offset = HWiNFO_HEADER_MIN_SIZE;
        let sensor_size = std::mem::size_of::<HwinfoSensorElement>() + 128;
        let reading_offset = sensor_offset + sensor_size;
        let reading_size = std::mem::size_of::<HwinfoReadingElement>() + 144;
        let mapped_len = reading_offset + reading_size;
        let mut bytes = vec![0u8; mapped_len];

        let mut sensor = HwinfoSensorElement {
            sensor_id: 1,
            sensor_instance: 0,
            sensor_name_orig: [0; HWiNFO_SENSORS_STRING_LEN],
            sensor_name_user: [0; HWiNFO_SENSORS_STRING_LEN],
        };
        sensor.sensor_name_orig[..3].copy_from_slice(b"CPU");

        let mut reading = HwinfoReadingElement {
            reading_type: 1,
            sensor_index: 0,
            reading_id: 1,
            label_orig: [0; HWiNFO_SENSORS_STRING_LEN],
            label_user: [0; HWiNFO_SENSORS_STRING_LEN],
            unit: [0; HWiNFO_UNIT_STRING_LEN],
            value: 72.5,
            value_min: 70.0,
            value_max: 75.0,
            value_avg: 72.0,
        };
        reading.label_orig[..11].copy_from_slice(b"CPU Package");
        reading.unit[..3].copy_from_slice("°C".as_bytes());

        unsafe {
            std::ptr::write_unaligned(
                bytes.as_mut_ptr().add(sensor_offset) as *mut HwinfoSensorElement,
                sensor,
            );
            std::ptr::write_unaligned(
                bytes.as_mut_ptr().add(reading_offset) as *mut HwinfoReadingElement,
                reading,
            );
        }

        let header = HwinfoSharedMemHeader {
            signature: HWiNFO_SIGNATURE_ACTIVE,
            version: 2,
            revision: 0,
            poll_time: 1,
            sensor_section_offset: sensor_offset as u32,
            sensor_element_size: sensor_size as u32,
            sensor_count: 1,
            reading_section_offset: reading_offset as u32,
            reading_element_size: reading_size as u32,
            reading_count: 1,
        };

        let snapshot = unsafe {
            parse_hwinfo_view(
                bytes.as_ptr(),
                bytes.len(),
                header,
                sensor_offset,
                sensor_size,
                reading_offset,
                reading_size,
            )
        }
        .unwrap();
        let reading = snapshot.cpu.unwrap();

        assert_eq!(reading.package_temperature, Some(72.5));
        assert!(reading.core_temperatures.is_empty());
    }
}
