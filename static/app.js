// Estado de la aplicación
let selectedCourses = [];
let schedules = [];
let currentScheduleIndex = 0;

// Configuración de grupos obligatorios
// Formato: { 'CES1159_1': { section: 1, groups: [0, 1] } }
let groupConfigs = {};

// Configuración de topones válidos para BACH1121
// Formato: { 'BACH1121_1_0': { section: 1, group: 0, tapon_type: 'completo', blocks: [...] } }
let toponesConfigs = {};

// Estructura de cursos cargada (secciones y grupos)
let courseStructures = {};

// Cargar configuración guardada desde el servidor
async function loadConfig() {
    try {
        const response = await fetch('/api/config/load');
        const data = await response.json();
        
        groupConfigs = data.groupConfigs || {};
        toponesConfigs = data.toponesConfigs || {};
        
        updateConfigList();
        updateToponesList();
    } catch (error) {
        console.error('Error cargando configuración:', error);
        groupConfigs = {};
        toponesConfigs = {};
    }
}

// Guardar configuración en el servidor
async function saveConfig() {
    try {
        const response = await fetch('/api/config/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                groupConfigs: groupConfigs,
                toponesConfigs: toponesConfigs
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Configuración guardada correctamente en el servidor');
        } else {
            showAlert('Error al guardar configuración: ' + (data.error || 'desconocido'));
        }
    } catch (error) {
        console.error('Error guardando configuración:', error);
        showAlert('Error al guardar configuración en el servidor');
    }
}

// Variable para almacenar horarios de BACH1121
let bach1121Horarios = [];

// Cargar horarios de BACH1121 para topones (en select dropdown)
async function loadBach1121Schedules() {
    const select = document.getElementById('toponHorarioSelect');
    if (!select) return;
    
    try {
        const response = await fetch('/api/bach1121/schedules');
        bach1121Horarios = await response.json();
        
        if (bach1121Horarios.length === 0) {
            select.innerHTML = '<option value="">No se encontraron horarios de BACH1121</option>';
            return;
        }
        
        // Construir opciones agrupadas por sección
        let html = '<option value="">Selecciona un horario...</option>';
        
        // Agrupar por sección
        const bySection = {};
        bach1121Horarios.forEach(h => {
            if (!bySection[h.section]) {
                bySection[h.section] = [];
            }
            bySection[h.section].push(h);
        });
        
        // Crear optgroups por sección
        Object.keys(bySection).sort((a, b) => parseInt(a) - parseInt(b)).forEach(section => {
            const items = bySection[section];
            const taponType = items[0].tapon_type;
            const taponLabel = taponType === 'completo' ? 'Completo' : 'Parcial';
            
            html += `<optgroup label="Sección ${section} (Tapón ${taponLabel})">`;
            
            items.forEach(item => {
                // Verificar si ya está agregado
                const isAdded = toponesConfigs[item.id];
                if (!isAdded) {
                    html += `<option value="${item.id}">${item.display}</option>`;
                }
            });
            
            html += '</optgroup>';
        });
        
        select.innerHTML = html;
        
    } catch (error) {
        console.error('Error cargando horarios BACH1121:', error);
        select.innerHTML = '<option value="">Error al cargar horarios</option>';
    }
}

// Agregar topón desde el select
function addToponConfig() {
    const select = document.getElementById('toponHorarioSelect');
    const horarioId = select.value;
    
    if (!horarioId) {
        showAlert('Selecciona un horario');
        return;
    }
    
    // Buscar el horario en la lista
    const horario = bach1121Horarios.find(h => h.id === horarioId);
    if (!horario) {
        showAlert('Horario no encontrado');
        return;
    }
    
    // Agregar a la configuración
    toponesConfigs[horarioId] = {
        id: horarioId,
        section: horario.section,
        group: horario.group,
        dia: horario.dia,
        hora_ini: horario.hora_ini,
        hora_fin: horario.hora_fin,
        tapon_type: horario.tapon_type,
        campus: horario.campus,
        display: horario.display
    };
    
    // Actualizar UI
    loadBach1121Schedules(); // Recargar select para quitar la opción ya agregada
    updateToponesList();
    
    showAlert(`Topón agregado: ${horario.display}`);
}

// Eliminar topón configurado
function removeTopon(key) {
    delete toponesConfigs[key];
    loadBach1121Schedules();
    updateToponesList();
}

// Actualizar lista de topones configurados
function updateToponesList() {
    const container = document.getElementById('configuredTopones');
    if (!container) return;
    
    const keys = Object.keys(toponesConfigs);
    if (keys.length === 0) {
        container.innerHTML = '<p class="empty-message">No hay topones configurados</p>';
        return;
    }
    
    container.innerHTML = keys.map(key => {
        const config = toponesConfigs[key];
        const taponLabel = config.tapon_type === 'completo' ? '🔴 Completo' : '🟡 Parcial';
        return `
            <div class="config-item topon-config-item">
                <div class="config-item-info">
                    <span class="config-item-course">BACH1121</span>
                    <span class="config-item-section">Sección ${config.section}</span>
                    <span class="tapon-type-badge tapon-${config.tapon_type}">${taponLabel}</span>
                    <div class="config-item-schedule">${config.dia} ${config.hora_ini} a ${config.hora_fin}</div>
                </div>
                <button class="btn-remove-config" onclick="removeTopon('${key}')">Eliminar</button>
            </div>
        `;
    }).join('');
}

// Cargar secciones de un curso
async function loadCourseSections() {
    const courseSelect = document.getElementById('configCourseSelect');
    const sectionSelect = document.getElementById('configSectionSelect');
    const groupsContainer = document.getElementById('configGroupsContainer');
    
    const courseCode = courseSelect.value;
    
    if (!courseCode) {
        sectionSelect.innerHTML = '<option value="">Primero selecciona un curso...</option>';
        groupsContainer.innerHTML = '<span class="empty-message">Selecciona curso y sección</span>';
        return;
    }
    
    try {
        const response = await fetch(`/api/course/${courseCode}/structure`);
        const structure = await response.json();
        courseStructures[courseCode] = structure;
        
        sectionSelect.innerHTML = '<option value="">Selecciona una sección...</option>';
        structure.forEach(sec => {
            sectionSelect.innerHTML += `<option value="${sec.section}">Sección ${sec.section}</option>`;
        });
        
        groupsContainer.innerHTML = '<span class="empty-message">Selecciona una sección</span>';
    } catch (error) {
        console.error('Error cargando secciones:', error);
        sectionSelect.innerHTML = '<option value="">Error al cargar</option>';
    }
}

// Cargar grupos de una sección
function loadSectionGroups() {
    const courseSelect = document.getElementById('configCourseSelect');
    const sectionSelect = document.getElementById('configSectionSelect');
    const groupsContainer = document.getElementById('configGroupsContainer');
    
    const courseCode = courseSelect.value;
    const sectionCode = sectionSelect.value;
    
    if (!courseCode || !sectionCode) {
        groupsContainer.innerHTML = '<span class="empty-message">Selecciona curso y sección</span>';
        return;
    }
    
    const structure = courseStructures[courseCode];
    if (!structure) return;
    
    const section = structure.find(s => s.section == sectionCode);
    if (!section) return;
    
    groupsContainer.innerHTML = section.groups.map(g => `
        <label class="group-checkbox">
            <input type="checkbox" value="${g}" class="config-group-check">
            <span>Grupo ${g}</span>
        </label>
    `).join('');
}

// Agregar configuración de grupos
function addGroupConfig() {
    const courseSelect = document.getElementById('configCourseSelect');
    const sectionSelect = document.getElementById('configSectionSelect');
    const groupCheckboxes = document.querySelectorAll('.config-group-check:checked');
    
    const courseCode = courseSelect.value;
    const sectionCode = sectionSelect.value;
    
    if (!courseCode) {
        showAlert('Selecciona un curso');
        return;
    }
    
    if (!sectionCode) {
        showAlert('Selecciona una sección');
        return;
    }
    
    // Obtener grupos seleccionados
    const groups = Array.from(groupCheckboxes).map(cb => parseInt(cb.value));
    
    if (groups.length < 2) {
        showAlert('Debes seleccionar al menos 2 grupos');
        return;
    }
    
    // Clave única: curso_sección
    const configKey = `${courseCode}_${sectionCode}`;
    groupConfigs[configKey] = {
        course: courseCode,
        section: parseInt(sectionCode),
        groups: groups
    };
    
    updateConfigList();
    
    // Limpiar formulario
    courseSelect.value = '';
    sectionSelect.innerHTML = '<option value="">Primero selecciona un curso...</option>';
    document.getElementById('configGroupsContainer').innerHTML = '<span class="empty-message">Selecciona curso y sección</span>';
    
    showAlert(`Configuración agregada: ${courseCode} sección ${sectionCode} con grupos ${groups.join(', ')}`);
}

// Eliminar configuración
function removeGroupConfig(configKey) {
    delete groupConfigs[configKey];
    updateConfigList();
}

// Actualizar lista de configuraciones
function updateConfigList() {
    const container = document.getElementById('configuredCourses');
    
    const keys = Object.keys(groupConfigs);
    if (keys.length === 0) {
        container.innerHTML = '<p class="empty-message">No hay cursos configurados</p>';
        return;
    }
    
    container.innerHTML = keys.map(configKey => {
        const config = groupConfigs[configKey];
        return `
            <div class="config-item">
                <div class="config-item-info">
                    <span class="config-item-course">${config.course}</span>
                    <span class="config-item-section">Sección ${config.section}</span>
                    <div class="config-item-groups">
                        Grupos: ${config.groups.map(g => `<span>Grupo ${g}</span>`).join('')}
                    </div>
                </div>
                <button class="btn-remove-config" onclick="removeGroupConfig('${configKey}')">Eliminar</button>
            </div>
        `;
    }).join('');
}

// Cambiar pestaña
function showTab(tabName) {
    // Ocultar todas las pestañas
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Mostrar la pestaña seleccionada
    document.getElementById(`tab-${tabName}`).classList.add('active');
    event.target.classList.add('active');
    
    // Si es la pestaña de configuración, cargar horarios de BACH1121
    if (tabName === 'configuracion') {
        loadBach1121Schedules();
    }
    
    // Si es la pestaña de datos, cargar datos del Excel
    if (tabName === 'datos') {
        loadExcelData();
    }
}

// Colores para los cursos
const courseColors = ['color-0', 'color-1', 'color-2', 'color-3', 'color-4', 'color-5'];

// Días de la semana (sin sábado)
const days = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];
const dayMap = {
    'Lunes': 0,
    'Martes': 1,
    'Miercoles': 2,
    'Miércoles': 2,
    'Jueves': 3,
    'Viernes': 4
};

// Horarios (bloques de 10 minutos desde 8:00 hasta 21:00)
const timeSlots = [];
for (let h = 8; h <= 21; h++) {
    for (let m = 0; m < 60; m += 10) {
        if (h === 21 && m > 0) break;
        timeSlots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
}

// Cargar configuración al inicio
loadConfig();
// Cargar horarios BACH1121 cuando se carga la página
loadBach1121Schedules();

// Búsqueda de cursos
document.getElementById('searchInput').addEventListener('input', function(e) {
    const query = e.target.value.toLowerCase();
    const items = document.querySelectorAll('.course-item');
    
    items.forEach(item => {
        const code = item.dataset.code.toLowerCase();
        const name = item.dataset.name.toLowerCase();
        
        if (code.includes(query) || name.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
});

// Añadir curso a la selección
function addCourse(code, name) {
    if (selectedCourses.length >= 6) {
        showAlert('Máximo 6 cursos permitidos');
        return;
    }
    
    if (selectedCourses.find(c => c.code === code)) {
        showAlert('Este curso ya está seleccionado');
        return;
    }
    
    selectedCourses.push({ code, name });
    updateSelectedList();
    updateCoursesList();
    updateGenerateButton();
}

// Eliminar curso de la selección
function removeCourse(code) {
    selectedCourses = selectedCourses.filter(c => c.code !== code);
    updateSelectedList();
    updateCoursesList();
    updateGenerateButton();
}

// Actualizar lista de seleccionados
function updateSelectedList() {
    const container = document.getElementById('selectedList');
    const countSpan = document.getElementById('selectedCount');

    countSpan.textContent = `(${selectedCourses.length}/6)`;

    if (selectedCourses.length === 0) {
        container.innerHTML = '<p class="empty-message">No hay cursos seleccionados</p>';
        return;
    }

    container.innerHTML = selectedCourses.map((course, index) => {
        return `
            <div class="selected-item">
                <div class="course-info">
                    <span class="course-code">${course.code}</span>
                    <span class="course-name">${course.name}</span>
                </div>
                <button class="btn-remove" onclick="removeCourse('${course.code}')">✕</button>
            </div>
        `;
    }).join('');
}

// Actualizar estado visual de cursos disponibles
function updateCoursesList() {
    const items = document.querySelectorAll('.course-item');
    items.forEach(item => {
        const isSelected = selectedCourses.find(c => c.code === item.dataset.code);
        if (isSelected) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// Actualizar botón de generar
function updateGenerateButton() {
    const btn = document.getElementById('generateBtn');
    btn.disabled = selectedCourses.length === 0;
}

// Generar horarios
async function generateSchedules() {
    const btn = document.getElementById('generateBtn');
    btn.innerHTML = '<span class="loading"></span> Generando...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                courses: selectedCourses.map(c => c.code),
                groupConfigs: groupConfigs,  // Enviar configuración de grupos
                validTopones: toponesConfigs  // Enviar topones válidos (puede estar vacío)
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            showAlert(data.error);
            return;
        }
        
        schedules = data.schedules;
        currentScheduleIndex = 0;
        
        if (schedules.length === 0) {
            showAlert('No se encontraron combinaciones de horarios. Verifica que los cursos tengan secciones disponibles.');
            document.getElementById('resultsPanel').style.display = 'none';
        } else {
            // Contar horarios: válidos, con topones válidos, con conflictos
            const validCount = schedules.filter(s => !s.has_conflicts && !s.has_valid_topones).length;
            const validToponCount = schedules.filter(s => !s.has_conflicts && s.has_valid_topones).length;
            const conflictCount = schedules.filter(s => s.has_conflicts).length;
            
            let message = '';
            if (validCount > 0) {
                message = `${validCount} horarios sin topones`;
            }
            if (validToponCount > 0) {
                message += message ? `, ${validToponCount} con topones válidos` : `${validToponCount} horarios con topones válidos`;
            }
            if (conflictCount > 0) {
                message += message ? ` y ${conflictCount} con topones inválidos` : `${conflictCount} horarios con topones`;
            }
            
            showAlert(message || 'No se encontraron horarios');
            displaySchedule();
        }
        
    } catch (error) {
        showAlert('Error al generar horarios');
        console.error(error);
    } finally {
        btn.innerHTML = '🚀 Generar Horarios';
        btn.disabled = selectedCourses.length === 0;
    }
}

// Mostrar horario actual
function displaySchedule() {
    if (schedules.length === 0) return;

    const schedule = schedules[currentScheduleIndex];
    const resultsPanel = document.getElementById('resultsPanel');
    const scheduleGrid = document.getElementById('scheduleGrid');
    const scheduleInfo = document.getElementById('scheduleInfo');
    const scheduleCounter = document.getElementById('scheduleCounter');

    resultsPanel.style.display = 'block';

    // Actualizar contador y botones de navegación
    scheduleCounter.textContent = `${currentScheduleIndex + 1} / ${schedules.length}`;
    document.getElementById('prevBtn').disabled = currentScheduleIndex === 0;
    document.getElementById('nextBtn').disabled = currentScheduleIndex === schedules.length - 1;

    // Mostrar cartel de topones si hay conflictos
    let conflictHTML = '';
    if (schedule.has_conflicts && schedule.conflicts && schedule.conflicts.length > 0) {
        const hasOverlap = schedule.conflict_types && schedule.conflict_types.includes('overlap');
        const hasTravelTime = schedule.conflict_types && schedule.conflict_types.includes('travel_time');
        
        let conflictTitle = '⚠️ TOPONES DETECTADOS';
        if (hasOverlap && hasTravelTime) {
            conflictTitle = '⚠️ TOPÓN HORARIO Y DE CAMPUS';
        } else if (hasOverlap) {
            conflictTitle = '⚠️ TOPÓN HORARIO';
        } else if (hasTravelTime) {
            conflictTitle = '⚠️ TOPÓN DE CAMPUS';
        }
        
        conflictHTML = `
            <div class="conflict-alert">
                <div class="conflict-header">${conflictTitle}</div>
                <ul class="conflict-list">
                    ${schedule.conflicts.map(c => `<li>${c}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    // Mostrar cartel verde de topones válidos
    let validToponHTML = '';
    if (schedule.has_valid_topones && schedule.valid_topones && schedule.valid_topones.length > 0) {
        const hasCompleto = schedule.valid_topon_types && schedule.valid_topon_types.includes('completo');
        const hasParcial = schedule.valid_topon_types && schedule.valid_topon_types.includes('parcial');
        
        let toponTitle = '✅ TOPONES VÁLIDOS';
        if (hasCompleto && hasParcial) {
            toponTitle = '✅ TOPONES VÁLIDOS (COMPLETO Y PARCIAL)';
        } else if (hasCompleto) {
            toponTitle = '✅ TOPÓN VÁLIDO COMPLETO';
        } else if (hasParcial) {
            toponTitle = '✅ TOPÓN VÁLIDO PARCIAL';
        }
        
        validToponHTML = `
            <div class="valid-topon-alert">
                <div class="valid-topon-header">${toponTitle}</div>
                <ul class="valid-topon-list">
                    ${schedule.valid_topones.map(t => `<li>${t}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    // Mostrar info de secciones con grupo
    scheduleInfo.innerHTML = conflictHTML + validToponHTML + schedule.sections.map((s, i) => `
        <span class="info-badge">${s.course} - Sec ${s.section} Grp ${s.group}</span>
    `).join('');

    // Crear mapa de colores para cursos
    const courseColorMap = {};
    selectedCourses.forEach((course, index) => {
        courseColorMap[course.code] = courseColors[index % courseColors.length];
    });

    // Crear matriz para almacenar bloques por celda (puede haber múltiples por celda = colisiones)
    const matriz = [];
    timeSlots.forEach(() => {
        matriz.push([[], [], [], [], []]); // 5 días, cada uno es un array de bloques
    });

    // Colocar bloques en la matriz (detectando colisiones)
    schedule.blocks.forEach(block => {
        const startMinutes = timeToMinutes(block.hora_ini);
        const endMinutes = timeToMinutes(block.hora_fin);
        const dayKey = normalizeDayName(block.dia);
        const dayIndex = days.indexOf(dayKey);

        if (dayIndex === -1) return;

        let isFirst = true;
        timeSlots.forEach((time, timeIndex) => {
            const slotMinutes = timeToMinutes(time);
            if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
                matriz[timeIndex][dayIndex].push({
                    block: block,
                    isStart: isFirst,
                    startMinutes: startMinutes,
                    endMinutes: endMinutes
                });
                isFirst = false;
            }
        });
    });

    // Calcular cuántos bloques colisionan en cada día/hora y asignar índice de columna
    const blockColumnInfo = new Map(); // blockId -> { columnIndex, totalColumns }
    const collisionGroups = new Map(); // dayIndex -> [{ blocks: [...], start, end }]
    
    // Para cada día, encontrar grupos de bloques que se superponen
    for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
        // Recolectar todos los bloques únicos del día con sus rangos
        const dayBlocks = [];
        timeSlots.forEach((_, timeIndex) => {
            matriz[timeIndex][dayIndex].forEach(item => {
                const blockId = `${item.block.curso}_${item.block.seccion}_${item.block.grupo}_${item.block.hora_ini}_${item.block.dia}`;
                if (!dayBlocks.find(b => b.id === blockId)) {
                    dayBlocks.push({
                        id: blockId,
                        block: item.block,
                        start: item.startMinutes,
                        end: item.endMinutes
                    });
                }
            });
        });

        // Agrupar bloques que se superponen
        const groups = [];
        dayBlocks.forEach(blockInfo => {
            // Encontrar si este bloque se superpone con algún grupo existente
            let foundGroup = null;
            for (const group of groups) {
                for (const existing of group) {
                    // Verificar si se superponen
                    if (blockInfo.start < existing.end && blockInfo.end > existing.start) {
                        foundGroup = group;
                        break;
                    }
                }
                if (foundGroup) break;
            }

            if (foundGroup) {
                foundGroup.push(blockInfo);
            } else {
                groups.push([blockInfo]);
            }
        });

        // Guardar grupos de colisiones para este día
        const dayCollisions = groups.filter(g => g.length > 1).map(group => ({
            blocks: group,
            start: Math.min(...group.map(b => b.start)),
            end: Math.max(...group.map(b => b.end))
        }));
        collisionGroups.set(dayIndex, dayCollisions);

        // Asignar índice de columna a cada bloque en cada grupo
        groups.forEach(group => {
            const totalColumns = group.length;
            group.forEach((blockInfo, colIndex) => {
                blockColumnInfo.set(blockInfo.id, {
                    columnIndex: colIndex,
                    totalColumns: totalColumns
                });
            });
        });
    }

    // Generar HTML usando tabla para mejor control
    let tableHTML = '<table class="schedule-table"><thead><tr>';
    tableHTML += '<th class="time-header">Hora</th>';
    days.forEach(day => {
        tableHTML += `<th class="day-header">${day}</th>`;
    });
    tableHTML += '</tr></thead><tbody>';

    // Track de celdas ya renderizadas (para rowspan)
    const renderedBlocks = new Set();
    const renderedCollisionGroups = new Set(); // Track de grupos de colisión ya renderizados

    // Generar filas - mostrar solo horas :00 y :30 en la columna de tiempo
    timeSlots.forEach((time, timeIndex) => {
        const showTime = time.endsWith(':00') || time.endsWith(':30');
        const timeDisplay = showTime ? time : '';
        const currentMinutes = timeToMinutes(time);

        tableHTML += '<tr>';
        tableHTML += `<td class="time-cell">${timeDisplay}</td>`;

        days.forEach((day, dayIndex) => {
            const cellBlocks = matriz[timeIndex][dayIndex];
            const dayCollisions = collisionGroups.get(dayIndex) || [];

            // Verificar si estamos en el inicio de un grupo de colisión
            const collisionGroup = dayCollisions.find(g => 
                g.start === currentMinutes && 
                !renderedCollisionGroups.has(`${dayIndex}_${g.start}_${g.end}`)
            );

            if (collisionGroup) {
                // Renderizar todo el grupo de colisión
                const groupId = `${dayIndex}_${collisionGroup.start}_${collisionGroup.end}`;
                renderedCollisionGroups.add(groupId);
                
                // Marcar todos los bloques del grupo como renderizados
                collisionGroup.blocks.forEach(blockInfo => {
                    renderedBlocks.add(blockInfo.id);
                });

                const totalDuration = collisionGroup.end - collisionGroup.start;
                const rowSpan = Math.ceil(totalDuration / 10);

                // Generar HTML con bloques lado a lado, altura completa
                let innerHTML = '<div class="collision-flex">';
                
                collisionGroup.blocks.forEach((blockInfo, idx) => {
                    const block = blockInfo.block;
                    const campus = block.campus || 'N/A';
                    const seccion = block.seccion || 'N/A';
                    const grupo = block.grupo || 'N/A';
                    
                    innerHTML += `
                        <div class="collision-block-flex ${courseColorMap[block.curso]}">
                            <div class="block-content">
                                <span class="block-title">${block.curso}</span>
                                <span class="block-section">Sec ${seccion} - Grp ${grupo}</span>
                                <span class="block-time">${block.hora_ini} - ${block.hora_fin}</span>
                                <span class="block-campus">${campus}</span>
                            </div>
                        </div>
                    `;
                });
                
                innerHTML += '</div>';
                tableHTML += `<td class="block-cell collision-cell" rowspan="${rowSpan}">${innerHTML}</td>`;
                return;
            }

            if (cellBlocks.length === 0) {
                // Celda vacía
                tableHTML += '<td class="empty-cell"></td>';
            } else {
                // Filtrar bloques que empiezan aquí y no han sido renderizados
                const startingBlocks = cellBlocks.filter(item => {
                    const blockId = `${item.block.curso}_${item.block.seccion}_${item.block.grupo}_${item.block.hora_ini}_${item.block.dia}`;
                    return item.isStart && !renderedBlocks.has(blockId);
                });

                // Verificar si hay bloques que continúan (ya renderizados con rowspan)
                const continuingBlocks = cellBlocks.filter(item => {
                    const blockId = `${item.block.curso}_${item.block.seccion}_${item.block.grupo}_${item.block.hora_ini}_${item.block.dia}`;
                    return renderedBlocks.has(blockId);
                });

                if (startingBlocks.length === 0 && continuingBlocks.length > 0) {
                    // Todos los bloques de esta celda ya fueron renderizados con rowspan, no agregar td
                    return;
                }

                if (startingBlocks.length === 0 && continuingBlocks.length === 0) {
                    tableHTML += '<td class="empty-cell"></td>';
                    return;
                }

                // Marcar bloques como renderizados
                startingBlocks.forEach(item => {
                    const blockId = `${item.block.curso}_${item.block.seccion}_${item.block.grupo}_${item.block.hora_ini}_${item.block.dia}`;
                    renderedBlocks.add(blockId);
                });

                // Un solo bloque (sin colisión - las colisiones ya se manejan arriba)
                if (startingBlocks.length === 1) {
                    const block = startingBlocks[0].block;
                    const campus = block.campus || 'N/A';
                    const seccion = block.seccion || 'N/A';
                    const grupo = block.grupo || 'N/A';
                    const duration = startingBlocks[0].endMinutes - startingBlocks[0].startMinutes;
                    const actualRowSpan = Math.ceil(duration / 10);

                    tableHTML += `<td class="block-cell ${courseColorMap[block.curso]}" rowspan="${actualRowSpan}">
                        <div class="block-content">
                            <span class="block-title">${block.curso}</span>
                            <span class="block-section">Sec ${seccion} - Grp ${grupo}</span>
                            <span class="block-time">${block.hora_ini} - ${block.hora_fin}</span>
                            <span class="block-campus">${campus}</span>
                        </div>
                    </td>`;
                }
            }
        });

        tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    scheduleGrid.innerHTML = tableHTML;
}

// Navegación entre horarios
function prevSchedule() {
    if (currentScheduleIndex > 0) {
        currentScheduleIndex--;
        displaySchedule();
    }
}

function nextSchedule() {
    if (currentScheduleIndex < schedules.length - 1) {
        currentScheduleIndex++;
        displaySchedule();
    }
}

// Utilidades
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.toString().split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
}

function normalizeDayName(day) {
    if (!day) return 'Lunes';
    day = day.toString().trim();
    
    const mapping = {
        'Lunes': 'Lunes',
        'Martes': 'Martes',
        'Miercoles': 'Miercoles',
        'Miércoles': 'Miercoles',
        'Jueves': 'Jueves',
        'Viernes': 'Viernes',
        'Sabado': 'Sabado',
        'Sábado': 'Sabado'
    };
    
    for (const key in mapping) {
        if (day.toLowerCase().includes(key.toLowerCase())) {
            return mapping[key];
        }
    }
    
    return day;
}

function getCampusShort(campus) {
    if (!campus) return '';
    campus = campus.toUpperCase();
    
    if (campus.includes('ALEMANIA') || campus.includes('RIVAS')) return 'ALEMANIA';
    if (campus.includes('NORTE') || campus.includes('PABLO')) return 'NORTE';
    if (campus.includes('VIRTUAL') || campus.includes('ONLINE')) return 'VIRTUAL';
    if (campus.includes('FRANCISCO')) return 'S.FCO';
    
    return campus.substring(0, 10);
}

// Mostrar alertas
function showAlert(message) {
    const alertBox = document.getElementById('alertBox');
    const alertMessage = document.getElementById('alertMessage');
    
    alertMessage.textContent = message;
    alertBox.style.display = 'flex';
    
    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 4000);
}

// ========== GESTIÓN DE DATOS DEL EXCEL ==========

let excelData = [];
let currentPage = 1;
let rowsPerPage = 25;

// Cargar todos los datos del Excel
async function loadExcelData() {
    try {
        const response = await fetch('/api/data/all');
        const result = await response.json();
        
        if (result.success) {
            excelData = result.data;
            displayDataTable();
        } else {
            showAlert('Error cargando datos: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Error cargando datos del servidor');
    }
}

// Mostrar tabla de datos sin paginación (todos los registros)
function displayDataTable() {
    const tbody = document.getElementById('dataTableBody');
    
    // Limpiar tabla
    tbody.innerHTML = '';
    
    // Agregar todas las filas
    for (let i = 0; i < excelData.length; i++) {
        const row = excelData[i];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="number" value="${row.sare_anho || ''}" onchange="updateCell(${i}, 'sare_anho', this.value)"></td>
            <td><input type="number" value="${row.sare_semestre || ''}" onchange="updateCell(${i}, 'sare_semestre', this.value)"></td>
            <td><input type="text" value="${row.asig_codigo || ''}" onchange="updateCell(${i}, 'asig_codigo', this.value)"></td>
            <td><input type="text" value="${row.asig_nombre || ''}" onchange="updateCell(${i}, 'asig_nombre', this.value)" style="min-width: 200px;"></td>
            <td><input type="number" value="${row.psec_codigo || ''}" onchange="updateCell(${i}, 'psec_codigo', this.value)"></td>
            <td><input type="number" value="${row.pgru_codigo || ''}" onchange="updateCell(${i}, 'pgru_codigo', this.value)"></td>
            <td>
                <select onchange="updateCell(${i}, 'sdia_descripcion', this.value)">
                    <option value="Lunes" ${row.sdia_descripcion === 'Lunes' ? 'selected' : ''}>Lunes</option>
                    <option value="Martes" ${row.sdia_descripcion === 'Martes' ? 'selected' : ''}>Martes</option>
                    <option value="Miercoles" ${row.sdia_descripcion === 'Miercoles' || row.sdia_descripcion === 'Miércoles' ? 'selected' : ''}>Miércoles</option>
                    <option value="Jueves" ${row.sdia_descripcion === 'Jueves' ? 'selected' : ''}>Jueves</option>
                    <option value="Viernes" ${row.sdia_descripcion === 'Viernes' ? 'selected' : ''}>Viernes</option>
                    <option value="Sabado" ${row.sdia_descripcion === 'Sabado' || row.sdia_descripcion === 'Sábado' ? 'selected' : ''}>Sábado</option>
                </select>
            </td>
            <td><input type="time" value="${row.sper_hora_ini || ''}" onchange="updateCell(${i}, 'sper_hora_ini', this.value)"></td>
            <td><input type="time" value="${row.sper_hora_fin || ''}" onchange="updateCell(${i}, 'sper_hora_fin', this.value)"></td>
            <td><input type="text" value="${row.camp_campus || ''}" onchange="updateCell(${i}, 'camp_campus', this.value)"></td>
            <td>
                <button class="btn-delete" onclick="deleteRow(${i})" title="Eliminar">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    }
    
    // Actualizar contador de registros (sin paginación)
    document.getElementById('pageInfo').textContent = `${excelData.length} registros totales`;
    
    // Ocultar botones de navegación
    document.getElementById('prevPageBtn').style.display = 'none';
    document.getElementById('nextPageBtn').style.display = 'none';
    document.getElementById('rowsPerPage').style.display = 'none';
}

// Actualizar celda
function updateCell(index, field, value) {
    if (excelData[index]) {
        excelData[index][field] = value;
    }
}

// Eliminar fila
function deleteRow(index) {
    if (confirm('¿Estás seguro de eliminar este registro?')) {
        excelData.splice(index, 1);
        displayDataTable();
    }
}

// Agregar nueva fila
function addNewRow() {
    const newRow = {
        sare_anho: 2024,
        sare_semestre: 1,
        uaca_codigo: null,
        uaca_nombre: null,
        sree_codigo: null,
        sree_nombre: null,
        sacu_codigo: null,
        asig_codigo: '',
        asig_nombre: '',
        psec_codigo: 1,
        pgru_codigo: 1,
        sper_hora_fin: '09:00',
        sper_hora_ini: '08:00',
        sdia_descripcion: 'Lunes',
        camp_campus: '',
        tsal_tipo: null,
        ambiente_especifico: null,
        sare_comentario: null
    };
    
    excelData.push(newRow);
    displayDataTable();
}

// Guardar cambios en el Excel
async function saveExcelData() {
    try {
        const response = await fetch('/api/data/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data: excelData })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('✅ Datos guardados correctamente en consolidado.xlsx');
            // Recargar la lista de cursos en la pestaña principal
            location.reload();
        } else {
            showAlert('❌ Error guardando datos: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('❌ Error guardando datos en el servidor');
    }
}

// Exportar datos
async function exportData() {
    try {
        window.location.href = '/api/data/export';
        showAlert('✅ Descargando archivo...');
    } catch (error) {
        console.error('Error:', error);
        showAlert('❌ Error exportando datos');
    }
}

// Importar datos
async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/data/import', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('✅ Archivo importado correctamente');
            await loadExcelData();
        } else {
            showAlert('❌ Error importando: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('❌ Error importando archivo');
    }
    
    // Limpiar input
    event.target.value = '';
}

// Navegación de páginas
function nextPage() {
    const totalPages = Math.ceil(excelData.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        displayDataTable();
    }
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        displayDataTable();
    }
}

function changeRowsPerPage() {
    const select = document.getElementById('rowsPerPage');
    rowsPerPage = parseInt(select.value);
    currentPage = 1;
    displayDataTable();
}

